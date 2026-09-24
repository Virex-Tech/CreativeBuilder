import { execFile } from "node:child_process";
import { copyFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { Post, ReferenceAsset, SocialAccount, Take } from "@prisma/client";

import { assetsDir } from "@/lib/assets";
import { fillPendingBroll, pendingBrollLayers, resolveProvider } from "@/lib/broll";
import { env } from "@/lib/env";
import { finalizeFootage } from "@/lib/footage";
import {
	containerStatus,
	createReelContainer,
	isConnected,
	publishContainer,
	refreshExpiringTokens,
} from "@/lib/instagram";
import { veoStatus } from "@/lib/kie";
import { prisma } from "@/lib/prisma";
import { renderFile, startRender } from "@/lib/render";
import { specHash, type Spec, type SpecIssues } from "@/lib/spec";
import {
	agentDisabledMessage,
	agentEnabled,
	editFromTakes,
	reviseFromTakes,
	type StudioContext,
} from "@/lib/specAuthor";
import { publicAssetUrl, takeFramesDir, type Transcript } from "@/lib/takes";

/**
 * Estúdio de conteúdo — o caminho de uma postagem, do horário vazio ao post no ar:
 *
 *   DRAFT        o time monta: referência, takes, instrução (nada roda sozinho aqui)
 *   QUEUED       alguém clicou "editar"
 *   PREPARING    espera os takes terminarem de processar (worker) e a referência ser lida
 *   EDITING      a IA edita: takes + referência + instrução → spec + legenda do post
 *   REVISING     a IA aplica um "pedir alteração" em cima da versão atual
 *   BROLL        gera o b-roll que a edição pediu (kie/Higgsfield), se pediu
 *   RENDERING    render do MP4 → cópia pública (o Instagram baixa dela)
 *   REVIEW       esperando o time aprovar ou pedir alteração
 *   APPROVED     aprovado, publicação manual (TikTok, conta não conectada, auto-publicar desligado)
 *   SCHEDULED    aprovado, publica sozinho no horário
 *   PUBLISHING   subindo pro Instagram (container → processamento → publicar)
 *   PUBLISHED    no ar  ·  FAILED  parou com erro (o "tentar de novo" retoma de onde dá)
 *
 * Mesmo desenho do pipeline de Concorrentes: o status é "o que falta fazer", o laço avança uma
 * postagem por status a cada volta e um restart no meio só faz a etapa rodar de novo.
 */

export const POST_STATUSES = [
	"DRAFT",
	"QUEUED",
	"PREPARING",
	"EDITING",
	"REVISING",
	"BROLL",
	"RENDERING",
	"REVIEW",
	"APPROVED",
	"SCHEDULED",
	"PUBLISHING",
	"PUBLISHED",
	"FAILED",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Status em que o time ainda pode mexer na montagem sem atropelar a IA. */
export const EDITABLE: PostStatus[] = ["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "FAILED"];

const run = promisify(execFile);

type PostFull = Post & { account: SocialAccount; takes: Take[]; reference: ReferenceAsset | null };

async function loadPost(id: string): Promise<PostFull> {
	return prisma.post.findUniqueOrThrow({
		where: { id },
		include: { account: true, reference: true, takes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
	});
}

async function setStatus(id: string, status: PostStatus, data: Partial<Post> = {}): Promise<void> {
	await prisma.post.update({
		where: { id },
		data: { ...data, status, ...(status === "FAILED" ? {} : { error: null }) } as object,
	});
}

async function existing(paths: string[]): Promise<string[]> {
	const out: string[] = [];
	for (const p of paths) {
		try {
			await stat(p);
			out.push(p);
		} catch {
			// sem frames (take antigo ou falhou): a IA segue só com a transcrição
		}
	}

	return out;
}

async function referenceFrames(referenceId: string): Promise<string[]> {
	const dir = join(env.STORAGE_DIR, "references", referenceId, "frames");
	try {
		return (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort().slice(0, 12).map((f) => join(dir, f));
	} catch {
		return [];
	}
}

/** Tudo que a IA precisa saber pra editar esta postagem. */
async function contextFor(post: PostFull, locale = "pt-BR"): Promise<StudioContext> {
	const app = await prisma.app.findUniqueOrThrow({ where: { id: post.appId } });
	const takes = post.takes.filter((t) => t.status === "DONE" && t.file && t.durationMs);

	let reference: StudioContext["reference"] = null;
	if (post.reference?.status === "DONE") {
		const manifest = post.reference.manifest as Record<string, unknown>;
		const transcript = (manifest.transcript as { text?: string } | undefined)?.text ?? null;
		// O manifest cru tem a lista de frames com caminhos — pra IA só interessa o ritmo.
		const { frames: _frames, transcript: _t, ...pacing } = manifest;
		reference = { manifest: pacing, framePaths: await referenceFrames(post.reference.id), transcript };
	}

	return {
		app: {
			id: app.id,
			name: app.name,
			director: app.director as Record<string, unknown>,
			brandKit: app.brandKit as Record<string, unknown>,
		},
		account: {
			handle: post.account.handle,
			platform: post.account.platform,
			persona: post.account.persona,
			style: post.account.style,
		},
		locale,
		takes: await Promise.all(
			takes.map(async (t) => ({
				id: t.id,
				src: publicAssetUrl(t.file) as string,
				durationMs: t.durationMs as number,
				transcript: t.transcript as Transcript | null,
				name: t.originalName,
				framePaths: await existing([join(takeFramesDir(t.id), "f1.jpg"), join(takeFramesDir(t.id), "f2.jpg")]),
			})),
		),
		reference,
		storageDir: env.STORAGE_DIR,
	};
}

/** Pergunta ao render se o spec passa no contrato (zod) — só ele é dono do schema. */
async function renderIssues(spec: Spec): Promise<string[]> {
	try {
		const res = await fetch(`${env.RENDER_SERVICE_URL}/validate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ spec }),
		});
		if (!res.ok) return [];
		const body = (await res.json()) as { ok: boolean; issues?: string[] };

		return body.ok ? [] : (body.issues ?? ["spec inválido"]);
	} catch {
		// Render fora do ar: o render de verdade vai reclamar depois, com a mensagem dele.
		return [];
	}
}

type AiOut = { spec: Spec; issues: SpecIssues; caption: string | null };

/**
 * Acabamento + checagem: corta na palavra, refaz a legenda e confere no render. Se o contrato
 * reclamar, a IA ganha UMA chance de corrigir só aquilo.
 */
async function finishSpec(ctx: StudioContext, out: AiOut, post: Post): Promise<AiOut> {
	if (out.issues.errors.length) throw new Error(`a IA gerou um spec inválido: ${out.issues.errors.slice(0, 3).join("; ")}`);
	let spec = await finalizeFootage(out.spec);
	spec.creativeId = post.id;
	let problems = await renderIssues(spec);
	if (problems.length === 0) return { ...out, spec };

	const repaired = await reviseFromTakes(
		ctx,
		spec,
		`O spec não passou na validação do renderer. Corrija SÓ estes erros, sem mudar a edição: ${problems.join("; ")}`,
		out.caption,
	);
	spec = await finalizeFootage(repaired.spec);
	spec.creativeId = post.id;
	problems = await renderIssues(spec);
	if (problems.length) throw new Error(`spec inválido pro render: ${problems.slice(0, 4).join("; ")}`);

	return { ...repaired, caption: repaired.caption ?? out.caption, spec };
}

async function saveVersion(post: Post, spec: Spec, note: string): Promise<string> {
	if (post.creativeId) {
		const last = await prisma.creativeVersion.findFirst({
			where: { creativeId: post.creativeId },
			orderBy: { version: "desc" },
		});
		await prisma.creativeVersion.create({
			data: {
				creativeId: post.creativeId,
				version: (last?.version ?? 0) + 1,
				spec: spec as object,
				specHash: specHash(spec),
				createdBy: "ai",
				note,
			},
		});

		return post.creativeId;
	}

	const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: post.accountId } });
	const creative = await prisma.creative.create({
		data: {
			appId: post.appId,
			userId: post.userId,
			name: `@${account.handle} · ${post.title ?? post.scheduledAt.toISOString().slice(0, 16).replace("T", " ")}`,
			mutation: "studio_edit",
			versions: {
				create: { version: 1, spec: spec as object, specHash: specHash(spec), createdBy: "ai", note },
			},
		},
	});

	return creative.id;
}

// ---------------------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------------------

async function stepQueued(post: Post): Promise<void> {
	await setStatus(post.id, "PREPARING");
}

async function stepPreparing(post: Post): Promise<void> {
	const full = await loadPost(post.id);
	const waiting = full.takes.some((t) => ["QUEUED", "GENERATING", "PROCESSING"].includes(t.status));
	const refWaiting = full.reference && ["QUEUED", "RUNNING"].includes(full.reference.status);
	if (waiting || refWaiting) return;
	if (full.takes.length > 0 && !full.takes.some((t) => t.status === "DONE")) {
		throw new Error("nenhum take pôde ser processado — veja o erro em cada take");
	}
	await setStatus(post.id, "EDITING");
}

async function stepEditing(post: Post): Promise<void> {
	if (!agentEnabled()) throw new Error(agentDisabledMessage("edição"));
	const full = await loadPost(post.id);
	const ctx = await contextFor(full);
	const out = await finishSpec(ctx, await editFromTakes(ctx, full.instructions), full);

	const creativeId = await saveVersion(full, out.spec, full.instructions ? `edição: ${full.instructions.slice(0, 200)}` : "edição");
	await setStatus(post.id, "BROLL", {
		creativeId,
		renderJobId: null,
		videoFile: null,
		...(full.caption?.trim() ? {} : { caption: out.caption }),
	});
}

async function stepRevising(post: Post): Promise<void> {
	if (!agentEnabled()) throw new Error(agentDisabledMessage("ajuste"));
	if (!post.creativeId) return setStatus(post.id, "QUEUED");
	if (!post.revisionNote) return setStatus(post.id, "BROLL");
	const full = await loadPost(post.id);
	const current = await prisma.creativeVersion.findFirstOrThrow({
		where: { creativeId: post.creativeId },
		orderBy: { version: "desc" },
	});
	const ctx = await contextFor(full);
	const out = await finishSpec(
		ctx,
		await reviseFromTakes(ctx, current.spec as unknown as Spec, post.revisionNote, full.caption),
		full,
	);

	await saveVersion(full, out.spec, `alteração: ${post.revisionNote.slice(0, 200)}`);
	await setStatus(post.id, "BROLL", {
		revisionNote: null,
		renderJobId: null,
		videoFile: null,
		...(out.caption && out.caption !== full.caption ? { caption: out.caption } : {}),
	});
}

async function stepBroll(post: Post): Promise<void> {
	if (!post.creativeId) return setStatus(post.id, "QUEUED");
	const current = await prisma.creativeVersion.findFirstOrThrow({
		where: { creativeId: post.creativeId },
		orderBy: { version: "desc" },
	});
	if (pendingBrollLayers(current.spec as unknown as Spec).length === 0) return setStatus(post.id, "RENDERING");

	const provider = resolveProvider();
	if (!provider) throw new Error("a edição pediu b-roll gerado, mas não há provedor configurado (KIE_API_KEY)");
	await fillPendingBroll(post.creativeId, provider);
	// Se sobrou (teto por chamada), a próxima volta continua.
}

/** Copia o MP4 pronto pra /assets (URL pública) + um poster pro calendário. */
async function publishRenderCopy(post: Post, renderJobId: string, outputPath: string | null): Promise<string> {
	const version = await prisma.creativeVersion.findFirst({
		where: { creativeId: post.creativeId as string },
		orderBy: { version: "desc" },
		select: { version: true },
	});
	const file = `post-${post.id}-v${version?.version ?? 0}.mp4`;
	const dest = join(assetsDir(), file);
	try {
		if (!outputPath) throw new Error("sem caminho");
		await copyFile(outputPath, dest);
	} catch {
		await writeFile(dest, Buffer.from(await (await renderFile(renderJobId)).arrayBuffer()));
	}
	await run("ffmpeg", ["-y", "-ss", "0.8", "-i", dest, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", dest.replace(/\.mp4$/, ".jpg")]).catch(
		() => undefined,
	);

	return file;
}

async function stepRendering(post: Post): Promise<void> {
	if (!post.creativeId) return setStatus(post.id, "QUEUED");
	if (!post.renderJobId) {
		const { job } = await startRender(post.creativeId);
		await setStatus(post.id, "RENDERING", { renderJobId: job.id });

		return;
	}
	const job = await prisma.renderJob.findUnique({ where: { id: post.renderJobId } });
	if (!job) return setStatus(post.id, "RENDERING", { renderJobId: null });
	if (job.status === "FAILED") throw new Error(`render falhou: ${job.error ?? "sem detalhe"}`);
	if (job.status !== "DONE") return;

	const videoFile = await publishRenderCopy(post, job.id, job.outputPath);
	await setStatus(post.id, "REVIEW", { videoFile, approvedAt: null, igContainerId: null });
}

async function stepScheduled(post: Post): Promise<void> {
	const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: post.accountId } });
	if (!isConnected(account)) {
		await prisma.post.update({
			where: { id: post.id },
			data: { status: "APPROVED", error: "a conta foi desconectada — conecte de novo ou poste à mão" },
		});

		return;
	}
	await setStatus(post.id, "PUBLISHING");
}

async function stepPublishing(post: Post): Promise<void> {
	const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: post.accountId } });
	if (post.externalId) return setStatus(post.id, "PUBLISHED");
	if (!isConnected(account)) throw new Error("conta do Instagram não conectada");
	if (!post.videoFile) throw new Error("sem vídeo aprovado pra publicar");

	if (!post.igContainerId) {
		const url = publicAssetUrl(post.videoFile);
		if (!url?.startsWith("https://")) throw new Error("PUBLIC_API_BASE precisa ser https pro Instagram baixar o vídeo");
		const containerId = await createReelContainer(account, url, post.caption ?? "");
		await prisma.post.update({ where: { id: post.id }, data: { igContainerId: containerId } });

		return;
	}

	const st = await containerStatus(account, post.igContainerId);
	if (st.status === "IN_PROGRESS") {
		// updatedAt é tocado a cada volta, então o teto conta a partir da hora de publicar.
		if (post.approvedAt && Date.now() - Math.max(post.approvedAt.getTime(), post.scheduledAt.getTime()) > 60 * 60 * 1000) {
			throw new Error("o Instagram passou de 1h processando o vídeo — tente de novo");
		}

		return;
	}
	if (st.status === "EXPIRED") {
		await prisma.post.update({ where: { id: post.id }, data: { igContainerId: null } });

		return;
	}
	if (st.status === "ERROR") {
		await prisma.post.update({ where: { id: post.id }, data: { igContainerId: null } });
		throw new Error(`o Instagram recusou o vídeo: ${st.detail ?? "sem detalhe"}`);
	}
	if (st.status === "PUBLISHED") return setStatus(post.id, "PUBLISHED", { publishedAt: new Date() });

	// FINISHED: publica e grava o id na hora — é isso que impede postar duas vezes.
	const out = await publishContainer(account, post.igContainerId);
	await setStatus(post.id, "PUBLISHED", { externalId: out.id, permalink: out.permalink, publishedAt: new Date() });
}

const STEPS: Partial<Record<PostStatus, (post: Post) => Promise<void>>> = {
	QUEUED: stepQueued,
	PREPARING: stepPreparing,
	EDITING: stepEditing,
	REVISING: stepRevising,
	BROLL: stepBroll,
	RENDERING: stepRendering,
	SCHEDULED: stepScheduled,
	PUBLISHING: stepPublishing,
};
const ACTIVE = Object.keys(STEPS) as PostStatus[];

/** Um lock por status: a IA (lenta) não trava o render nem a publicação. */
const busy = new Set<string>();

async function withLock(key: string, fn: () => Promise<void>): Promise<void> {
	if (busy.has(key)) return;
	busy.add(key);
	try {
		await fn();
	} finally {
		busy.delete(key);
	}
}

/** Takes gerados na kie.ai: quando fica pronto, vira um take comum (o worker baixa e processa). */
async function pollGeneratedTakes(): Promise<void> {
	const take = await prisma.take.findFirst({ where: { status: "GENERATING" }, orderBy: { createdAt: "asc" } });
	if (!take?.providerTask) return;
	const st = await veoStatus(take.providerTask);
	if (st.state === "done") {
		await prisma.take.update({ where: { id: take.id }, data: { sourceUrl: st.url, status: "QUEUED" } });
	} else if (st.state === "failed") {
		await prisma.take.update({ where: { id: take.id }, data: { status: "FAILED", error: st.error } });
	} else if (Date.now() - take.createdAt.getTime() > 25 * 60 * 1000) {
		await prisma.take.update({ where: { id: take.id }, data: { status: "FAILED", error: "a kie.ai passou de 25 min sem entregar" } });
	}
}

let lastTokenRefresh = 0;

export async function tickStudio(): Promise<void> {
	await Promise.all([
		...ACTIVE.map((status) =>
			withLock(status, async () => {
				const post = await prisma.post.findFirst({
					// Agendado só entra na vez quando chega a hora — senão gira à toa entre dezenas.
					where: status === "SCHEDULED" ? { status, scheduledAt: { lte: new Date() } } : { status },
					orderBy: { updatedAt: "asc" },
				});
				if (!post) return;
				try {
					await STEPS[status]?.(post);
					const after = await prisma.post.findUnique({ where: { id: post.id } });
					if (after && after.status === status && after.updatedAt.getTime() === post.updatedAt.getTime()) {
						await prisma.post.update({ where: { id: post.id }, data: { updatedAt: new Date() } });
					}
				} catch (err) {
					await prisma.post.update({
						where: { id: post.id },
						data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
					});
				}
			}),
		),
		withLock("takes", () => pollGeneratedTakes().catch(() => undefined)),
		withLock("tokens", async () => {
			if (Date.now() - lastTokenRefresh < 60 * 60 * 1000) return;
			lastTokenRefresh = Date.now();
			await refreshExpiringTokens();
		}),
	]);
}

export function startStudioLoop(log: { error: (o: unknown, msg: string) => void }): void {
	if (env.STUDIO_ENABLED !== "true") return;
	const loop = (): void => {
		tickStudio()
			.catch((err: unknown) => log.error({ err }, "estúdio: volta falhou"))
			.finally(() => setTimeout(loop, env.STUDIO_TICK_MS));
	};
	setTimeout(loop, env.STUDIO_TICK_MS);
}

/** "Tentar de novo": retoma do que já existe, sem refazer (nem repagar) o que deu certo. */
export async function resumeStatus(post: Post): Promise<{ status: PostStatus; patch: Partial<Post> }> {
	if (post.externalId) return { status: "PUBLISHED", patch: {} };
	if (post.approvedAt && post.videoFile) {
		const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: post.accountId } });

		return { status: isConnected(account) && account.autoPublish ? "SCHEDULED" : "APPROVED", patch: {} };
	}
	if (post.videoFile) return { status: "REVIEW", patch: {} };
	if (post.revisionNote && post.creativeId) return { status: "REVISING", patch: {} };
	if (post.creativeId) return { status: "BROLL", patch: { renderJobId: null } };

	return { status: "QUEUED", patch: {} };
}
