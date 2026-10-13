import type { CompetitorAd } from "@prisma/client";
import { z } from "zod";

import { adLibraryEnabled, adLibraryUrl, daysRunning, type LibraryAd, pageWinners, termWinners } from "@/lib/adLibrary";
import { BROLL_PROVIDERS, fillPendingBroll, pendingBrollLayers, resolveProvider } from "@/lib/broll";
import { env } from "@/lib/env";
import { createDraftAd, metaEnabled } from "@/lib/metaAds";
import { prisma } from "@/lib/prisma";
import { renderFile, startRender } from "@/lib/render";
import { specHash, type Spec } from "@/lib/spec";
import { agentDisabledMessage, agentEnabled, authorSpec } from "@/lib/specAuthor";
import { advertiserWinners, keywordWinners, mediaUrl, trendtrackEnabled, type TtAd } from "@/lib/trendtrack";

/**
 * Pipeline "Concorrentes" — o fluxo da tela de 3 colunas:
 *
 *   01 SCAN      acha os anúncios vencedores (ativos há ≥ N dias) em até 3 fontes:
 *                TrendTrack (pago, cobre o Brasil) · Biblioteca da Meta oficial (grátis, só o que
 *                roda na UE/UK) · manual (o time cola o link da Biblioteca ou sobe o vídeo)
 *   02 GENERATE  o vencedor vira REFERÊNCIA (frames/ritmo) → a IA escreve o spec do NOSSO app
 *                → b-roll (kie/Higgsfield) → render do MP4
 *   03 DRAFT     o MP4 sobe pra Meta como anúncio PAUSADO, esperando revisão humana
 *
 * Cada anúncio é uma linha `competitor_ads` e `stage` diz o que falta fazer. Os estágios são
 * "a fazer", não "fazendo": se a API reinicia no meio, o laço refaz a etapa. Só três etapas
 * esperam coisa externa (INGESTING = worker ingerindo; RENDERING = render service; ambos
 * reconciliados pelo worker).
 *
 * Nada gasta sozinho sem opt-in: por padrão os vencedores param em SPOTTED até alguém clicar
 * "recriar", e param em READY até alguém clicar "enviar pra Meta". `autoRecreate`/`autoDraft`
 * na config do app ligam o modo automático.
 */

export const STAGES = [
	"SPOTTED",
	"QUEUED",
	"INGESTING",
	"GENERATING",
	"BROLL",
	"RENDERING",
	"READY",
	"DRAFT_QUEUED",
	"DRAFTED",
	"FAILED",
	"DISMISSED",
] as const;
export type Stage = (typeof STAGES)[number];

/** Estágios que o laço trabalha (os demais só mudam por ação humana). */
const ACTIVE: Stage[] = ["QUEUED", "INGESTING", "GENERATING", "BROLL", "RENDERING", "DRAFT_QUEUED"];

export const pipelineConfigSchema = z.object({
	/** Páginas do Facebook dos concorrentes (id da página = advertiserId no TrendTrack). */
	competitors: z.array(z.object({ name: z.string().min(1), pageId: z.string().min(1) })).max(30).default([]),
	/** Termos de copy pra achar vencedores de quem ainda não está mapeado. */
	keywords: z.array(z.string().min(2)).max(10).default([]),
	/** ISO-2 (ex: BR, US) — filtra a busca por termo no TrendTrack. */
	countries: z.array(z.string().length(2)).max(10).default([]),
	/** ISO-2 onde procurar na Biblioteca oficial. Vazio = UE/UK (onde anúncio comercial é visível). */
	libraryCountries: z.array(z.string().length(2)).max(20).default([]),
	/** Quais fontes a varredura usa (cada uma só roda se estiver configurada no servidor). */
	sources: z
		.object({ trendtrack: z.boolean().default(true), metaLibrary: z.boolean().default(true) })
		.default({}),
	/** "Vencedor" = ativo há pelo menos N dias (ninguém mantém gastando no que não converte). */
	minDaysRunning: z.number().int().min(0).max(365).default(14),
	/** Máximo por concorrente/termo por varredura. O TrendTrack cobra POR LINHA devolvida. */
	perSource: z.number().int().min(1).max(20).default(5),
	locale: z.string().default("pt-BR"),
	brollProvider: z.enum(BROLL_PROVIDERS).optional(),
	autoRecreate: z.boolean().default(false),
	autoDraft: z.boolean().default(false),
	meta: z
		.object({
			adsetId: z.string().optional(),
			pageId: z.string().optional(),
			instagramUserId: z.string().optional(),
			link: z.string().url().optional(),
			message: z.string().optional(),
			callToAction: z.string().default("LEARN_MORE"),
		})
		.default({}),
});
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

export function readConfig(raw: unknown): PipelineConfig {
	const parsed = pipelineConfigSchema.safeParse(raw ?? {});

	return parsed.success ? parsed.data : pipelineConfigSchema.parse({});
}

// ---------------------------------------------------------------------------------------
// 01 — varredura
// ---------------------------------------------------------------------------------------

export interface ScanResult {
	found: number;
	created: number;
	creditsRemaining: number | null;
	errors: string[];
}

/** Um vencedor já normalizado, venha de onde vier. */
interface Found {
	source: "trendtrack" | "meta_library";
	externalId: string;
	advertiser: string | null;
	pageId: string | null;
	mediaType: string | null;
	thumbnailUrl: string | null;
	daysRunning: number | null;
	reach: number | null;
	content: Record<string, unknown>;
	raw: unknown;
}

function fromTrendtrack(ad: TtAd): Found {
	return {
		source: "trendtrack",
		externalId: ad.id,
		advertiser: ad.advertiser?.name ?? null,
		pageId: ad.advertiser?.facebookPageId ?? ad.advertiser?.id ?? null,
		mediaType: ad.media?.type ?? null,
		thumbnailUrl: ad.media?.thumbnailUrl ?? null,
		daysRunning: ad.daysRunning ?? null,
		reach: ad.metrics?.reach ?? null,
		content: {
			title: ad.content?.title ?? null,
			body: ad.content?.body ?? null,
			transcript: ad.content?.transcript ?? null,
			callToAction: ad.content?.callToAction ?? null,
			landingPageUrl: ad.content?.landingPageUrl ?? null,
			estimatedSpend: ad.metrics?.estimatedSpend ?? null,
			duplicates: ad.metrics?.duplicates ?? null,
			firstSeenAt: ad.firstSeenAt ?? null,
		},
		raw: ad,
	};
}

function fromLibrary(ad: LibraryAd): Found {
	return {
		source: "meta_library",
		externalId: ad.id,
		advertiser: ad.page_name ?? null,
		pageId: ad.page_id ?? null,
		mediaType: "video",
		thumbnailUrl: null,
		daysRunning: daysRunning(ad),
		reach: ad.eu_total_reach ?? null,
		content: {
			title: ad.ad_creative_link_titles?.[0] ?? null,
			body: ad.ad_creative_bodies?.[0] ?? null,
			callToAction: ad.ad_creative_link_captions?.[0] ?? null,
			firstSeenAt: ad.ad_delivery_start_time ?? null,
			libraryUrl: adLibraryUrl(ad.id),
		},
		raw: ad,
	};
}

/** Varre as fontes ligadas e grava os vencedores novos. Não re-enfileira os já vistos. */
export async function scanWinners(appId: string): Promise<ScanResult> {
	const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
	const cfg = readConfig(app.pipeline);
	const filter = { limit: cfg.perSource, minDaysRunning: cfg.minDaysRunning, mediaType: "video" as const };
	const libFilter = { limit: cfg.perSource, minDaysRunning: cfg.minDaysRunning, countries: cfg.libraryCountries };

	const found = new Map<string, Found>();
	const errors: string[] = [];
	let creditsRemaining: number | null = null;
	const add = (f: Found): void => void found.set(`${f.source}:${f.externalId}`, f);
	const attempt = async (label: string, fn: () => Promise<void>): Promise<void> => {
		try {
			await fn();
		} catch (err) {
			errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
		}
	};

	if (cfg.sources.trendtrack && trendtrackEnabled()) {
		for (const c of cfg.competitors) {
			await attempt(`TrendTrack ${c.name}`, async () => {
				const out = await advertiserWinners(c.pageId, filter);
				creditsRemaining = out.creditsRemaining ?? creditsRemaining;
				out.data.forEach((ad) => add(fromTrendtrack(ad)));
			});
		}
		for (const term of cfg.keywords) {
			await attempt(`TrendTrack "${term}"`, async () => {
				const out = await keywordWinners([term], { ...filter, countries: cfg.countries });
				creditsRemaining = out.creditsRemaining ?? creditsRemaining;
				out.data.forEach((ad) => add(fromTrendtrack(ad)));
			});
		}
	}

	if (cfg.sources.metaLibrary && adLibraryEnabled()) {
		for (const c of cfg.competitors) {
			await attempt(`Biblioteca ${c.name}`, async () => {
				(await pageWinners(c.pageId, libFilter)).forEach((ad) => add(fromLibrary(ad)));
			});
		}
		for (const term of cfg.keywords) {
			await attempt(`Biblioteca "${term}"`, async () => {
				(await termWinners(term, libFilter)).forEach((ad) => add(fromLibrary(ad)));
			});
		}
	}

	let created = 0;
	for (const f of found.values()) {
		const key = { appId_source_externalId: { appId, source: f.source, externalId: f.externalId } };
		const fresh = {
			advertiser: f.advertiser,
			pageId: f.pageId,
			mediaType: f.mediaType,
			thumbnailUrl: f.thumbnailUrl,
			daysRunning: f.daysRunning,
			reach: f.reach,
			content: f.content as object,
			raw: f.raw as object,
		};
		const existing = await prisma.competitorAd.findUnique({ where: key });
		if (existing) {
			// Só atualiza os números — nunca mexe no estágio de algo que já está andando.
			await prisma.competitorAd.update({ where: { id: existing.id }, data: fresh });
			continue;
		}
		await prisma.competitorAd.create({
			data: {
				appId,
				source: f.source,
				externalId: f.externalId,
				...fresh,
				stage: cfg.autoRecreate ? "QUEUED" : "SPOTTED",
			},
		});
		created++;
	}

	return { found: found.size, created, creditsRemaining, errors };
}

/**
 * Fonte manual: o time cola o link de um anúncio (Biblioteca da Meta, Instagram, TikTok...) ou
 * sobe o vídeo. Quem escolheu foi uma pessoa, então já entra trabalhando (INGESTING).
 */
export async function addManual(
	appId: string,
	userId: string,
	input: { sourceUrl?: string; filePath?: string; advertiser?: string },
): Promise<CompetitorAd> {
	const libraryId = input.sourceUrl ? new URL(input.sourceUrl).searchParams.get("id") : null;
	const externalId = libraryId ?? input.sourceUrl ?? `upload-${crypto.randomUUID()}`;

	const existing = await prisma.competitorAd.findUnique({
		where: { appId_source_externalId: { appId, source: "manual", externalId } },
	});
	if (existing) return existing;

	const ref = await prisma.referenceAsset.create({
		data: { appId, userId, sourceUrl: input.sourceUrl ?? null, filePath: input.filePath ?? null, status: "QUEUED" },
	});

	return prisma.competitorAd.create({
		data: {
			appId,
			source: "manual",
			externalId,
			advertiser: input.advertiser ?? null,
			mediaType: "video",
			content: (input.sourceUrl ? { libraryUrl: input.sourceUrl } : {}) as object,
			stage: "INGESTING",
			referenceId: ref.id,
		},
	});
}

// ---------------------------------------------------------------------------------------
// 02/03 — máquina de estágios
// ---------------------------------------------------------------------------------------

export async function setStage(id: string, stage: Stage, data: Partial<CompetitorAd> = {}): Promise<void> {
	await prisma.competitorAd.update({
		where: { id },
		data: { ...data, stage, ...(stage === "FAILED" ? {} : { error: null }) } as object,
	});
}

async function fail(id: string, err: unknown): Promise<void> {
	await prisma.competitorAd.update({
		where: { id },
		data: { stage: "FAILED", error: err instanceof Error ? err.message : String(err) },
	});
}

/** O brief que a IA recebe: o que o vencedor faz, e a trava de só copiar estrutura. */
function briefFor(row: CompetitorAd, appName: string): string {
	const c = row.content as Record<string, string | number | null>;
	const lines = [
		`Recrie para o app ${appName} a ESTRUTURA de um anúncio vencedor de concorrente` +
			` (${row.advertiser ?? "concorrente"}, ${row.daysRunning ?? "?"} dias no ar` +
			`${row.reach ? `, alcance ~${Math.round(row.reach).toLocaleString("pt-BR")}` : ""}).`,
		"Copie só o formato, o ângulo do hook e o ritmo — nunca a marca, o produto, o texto literal, rostos ou imagens do concorrente.",
		"Adapte hook, promessa e CTA ao nosso app. Se o ângulo dele conflitar com as regras (never) do DirectorProfile, troque o ângulo e mantenha o formato.",
		"B-roll: descreva cenas genéricas (sem marca, sem texto na imagem) nas camadas generative_video; todo texto vem das camadas de texto.",
	];
	if (c.title) lines.push(`\nTítulo original: ${c.title}`);
	if (c.body) lines.push(`Copy original: ${String(c.body).slice(0, 1200)}`);
	if (c.transcript) lines.push(`Fala original (transcrição): ${String(c.transcript).slice(0, 2000)}`);
	if (c.callToAction) lines.push(`CTA original: ${c.callToAction}`);

	return lines.join("\n");
}

/** De onde o worker baixa o vídeo, conforme a fonte. */
async function videoUrlFor(row: CompetitorAd): Promise<string> {
	// TrendTrack: URL fresca na hora — a do scan pode ser `external_direct` e já ter expirado.
	if (row.source === "trendtrack") return (await mediaUrl(row.externalId)).url;
	// Biblioteca oficial não entrega o arquivo: o yt-dlp baixa pelo link público do anúncio.
	if (row.source === "meta_library") return adLibraryUrl(row.externalId);
	const url = (row.content as { libraryUrl?: string }).libraryUrl;
	if (!url) throw new Error("anúncio manual sem link — adicione de novo");

	return url;
}

async function stepQueued(row: CompetitorAd): Promise<void> {
	if (row.mediaType && row.mediaType !== "video") throw new Error("por enquanto só anúncios em vídeo");
	const app = await prisma.app.findUniqueOrThrow({ where: { id: row.appId } });
	const ref = await prisma.referenceAsset.create({
		data: { appId: row.appId, userId: app.ownerId, sourceUrl: await videoUrlFor(row), status: "QUEUED" },
	});
	await setStage(row.id, "INGESTING", { referenceId: ref.id });
}

async function stepIngesting(row: CompetitorAd): Promise<void> {
	if (!row.referenceId) return setStage(row.id, "QUEUED");
	const ref = await prisma.referenceAsset.findUnique({ where: { id: row.referenceId } });
	if (!ref) return setStage(row.id, "QUEUED");
	if (ref.status === "DONE") return setStage(row.id, "GENERATING");
	if (ref.status === "FAILED") throw new Error(`ingestão falhou: ${ref.error ?? "sem detalhe"}`);
}

async function stepGenerating(row: CompetitorAd): Promise<void> {
	if (!agentEnabled()) throw new Error(agentDisabledMessage("geração"));
	const app = await prisma.app.findUniqueOrThrow({ where: { id: row.appId } });
	const ref = row.referenceId ? await prisma.referenceAsset.findUnique({ where: { id: row.referenceId } }) : null;
	const cfg = readConfig(app.pipeline);
	const name = `RUN · ${row.advertiser ?? "concorrente"} · ${row.externalId.slice(-6)}`;

	const result = await authorSpec({
		app: {
			id: app.id,
			name: app.name,
			director: app.director as Record<string, unknown>,
			brandKit: app.brandKit as Record<string, unknown>,
		},
		name,
		locale: cfg.locale,
		brief: briefFor(row, app.name),
		referenceId: ref?.status === "DONE" ? ref.id : undefined,
		referenceManifest: ref?.status === "DONE" ? (ref.manifest as Record<string, unknown>) : undefined,
		storageDir: env.STORAGE_DIR,
	});
	if (result.issues.errors.length) {
		throw new Error(`IA gerou spec inválido: ${result.issues.errors.slice(0, 3).join("; ")}`);
	}

	const creative = await prisma.creative.create({
		data: {
			appId: app.id,
			userId: app.ownerId,
			name,
			locale: cfg.locale,
			mutation: "competitor_recreate",
			versions: {
				create: {
					version: 1,
					spec: result.spec as object,
					specHash: specHash(result.spec),
					createdBy: "ai",
					note: `recriado do anúncio ${row.externalId} (${row.source})`,
				},
			},
		},
	});
	await setStage(row.id, "BROLL", { creativeId: creative.id });
}

async function stepBroll(row: CompetitorAd): Promise<void> {
	if (!row.creativeId) return setStage(row.id, "GENERATING");
	const app = await prisma.app.findUniqueOrThrow({ where: { id: row.appId } });
	const current = await prisma.creativeVersion.findFirst({
		where: { creativeId: row.creativeId },
		orderBy: { version: "desc" },
	});
	if (!current) throw new Error("criativo sem versão");
	if (pendingBrollLayers(current.spec as unknown as Spec).length === 0) return setStage(row.id, "RENDERING");

	const provider = resolveProvider(readConfig(app.pipeline).brollProvider);
	if (!provider) throw new Error("nenhum provedor de b-roll configurado (KIE_API_KEY ou Higgsfield)");
	const out = await fillPendingBroll(row.creativeId, provider);
	// Se ainda sobrou (teto por chamada ou falha parcial), o próximo tick continua.
	if (out.unchanged || !out.truncated) {
		const after = await prisma.creativeVersion.findFirst({
			where: { creativeId: row.creativeId },
			orderBy: { version: "desc" },
		});
		if (after && pendingBrollLayers(after.spec as unknown as Spec).length === 0) {
			await setStage(row.id, "RENDERING");
		}
	}
}

async function stepRendering(row: CompetitorAd): Promise<void> {
	if (!row.creativeId) return setStage(row.id, "GENERATING");
	if (!row.renderJobId) {
		const { job } = await startRender(row.creativeId);
		await setStage(row.id, "RENDERING", { renderJobId: job.id });

		return;
	}
	const job = await prisma.renderJob.findUnique({ where: { id: row.renderJobId } });
	if (!job) return setStage(row.id, "RENDERING", { renderJobId: null });
	if (job.status === "FAILED") throw new Error(`render falhou: ${job.error ?? "sem detalhe"}`);
	if (job.status !== "DONE") return;

	const app = await prisma.app.findUniqueOrThrow({ where: { id: row.appId } });
	await setStage(row.id, readConfig(app.pipeline).autoDraft && metaEnabled() ? "DRAFT_QUEUED" : "READY");
}

async function stepDraft(row: CompetitorAd): Promise<void> {
	if (!metaEnabled()) throw new Error("Meta Ads indisponível: configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID");
	if (!row.renderJobId || !row.creativeId) throw new Error("sem render pronto pra enviar");
	const app = await prisma.app.findUniqueOrThrow({ where: { id: row.appId } });
	const creative = await prisma.creative.findUniqueOrThrow({ where: { id: row.creativeId } });
	const m = readConfig(app.pipeline).meta;

	const adsetId = m.adsetId ?? env.META_ADSET_ID;
	const pageId = m.pageId ?? env.META_PAGE_ID;
	const link = m.link;
	const missing = [!adsetId && "conjunto (adsetId)", !pageId && "página (pageId)", !link && "link de destino"].filter(Boolean);
	if (missing.length) throw new Error(`falta configurar no pipeline do app: ${missing.join(", ")}`);

	const result = await createDraftAd({
		name: creative.name,
		video: await renderFile(row.renderJobId),
		adsetId: adsetId as string,
		pageId: pageId as string,
		instagramUserId: m.instagramUserId ?? env.META_INSTAGRAM_USER_ID,
		link: link as string,
		message: m.message ?? app.name,
		callToAction: m.callToAction,
	});
	await setStage(row.id, "DRAFTED", { meta: result as unknown as CompetitorAd["meta"] });
}

const STEPS: Partial<Record<Stage, (row: CompetitorAd) => Promise<void>>> = {
	QUEUED: stepQueued,
	INGESTING: stepIngesting,
	GENERATING: stepGenerating,
	BROLL: stepBroll,
	RENDERING: stepRendering,
	DRAFT_QUEUED: stepDraft,
};

/** Um lock por estágio: etapas lentas (IA, b-roll, upload) não travam as rápidas. */
const busy = new Set<Stage>();

/** Avança UMA linha de cada estágio ativo. Chamado em laço por `startPipelineLoop`. */
export async function tickPipeline(): Promise<void> {
	await Promise.all(
		ACTIVE.map(async (stage) => {
			if (busy.has(stage)) return;
			busy.add(stage);
			try {
				const row = await prisma.competitorAd.findFirst({ where: { stage }, orderBy: { updatedAt: "asc" } });
				if (!row) return;
				try {
					await STEPS[stage]?.(row);
					// Estágios de espera (sem mudança) ainda "tocam" a linha pra fila girar entre várias.
					const after = await prisma.competitorAd.findUnique({ where: { id: row.id } });
					if (after && after.stage === stage && after.updatedAt.getTime() === row.updatedAt.getTime()) {
						await prisma.competitorAd.update({ where: { id: row.id }, data: { updatedAt: new Date() } });
					}
				} catch (err) {
					await fail(row.id, err);
				}
			} finally {
				busy.delete(stage);
			}
		}),
	);
}

export function startPipelineLoop(log: { error: (o: unknown, msg: string) => void }): void {
	if (env.PIPELINE_ENABLED !== "true") return;
	const run = (): void => {
		tickPipeline()
			.catch((err: unknown) => log.error({ err }, "pipeline: tick falhou"))
			.finally(() => setTimeout(run, env.PIPELINE_TICK_MS));
	};
	setTimeout(run, env.PIPELINE_TICK_MS);
}

/**
 * "Tentar de novo": deduz a etapa pelo que já existe, pra não refazer (nem repagar) o que deu
 * certo. Ex.: se o render está pronto e só o envio pra Meta falhou, volta pra READY.
 */
export async function resumeStage(row: CompetitorAd): Promise<{ stage: Stage; patch: Partial<CompetitorAd> }> {
	if ((row.meta as { adId?: string } | null)?.adId) return { stage: "DRAFTED", patch: {} };
	if (row.renderJobId) {
		const job = await prisma.renderJob.findUnique({ where: { id: row.renderJobId } });
		if (job?.status === "DONE") return { stage: "READY", patch: {} };
	}
	// Render que falhou/sumiu é descartado: o próximo RENDERING dispara outro.
	if (row.creativeId) return { stage: "BROLL", patch: { renderJobId: null } };
	if (row.referenceId) {
		const ref = await prisma.referenceAsset.findUnique({ where: { id: row.referenceId } });
		if (ref?.status === "DONE") return { stage: "GENERATING", patch: {} };
		if (ref && ref.status !== "FAILED") return { stage: "INGESTING", patch: {} };
	}

	return { stage: "QUEUED", patch: { referenceId: null } };
}
