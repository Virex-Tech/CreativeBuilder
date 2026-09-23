import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { adLibraryEnabled } from "@/lib/adLibrary";

import { enabledProviders } from "@/lib/broll";
import { env } from "@/lib/env";
import { metaEnabled } from "@/lib/metaAds";
import {
	addManual,
	pipelineConfigSchema,
	readConfig,
	resumeStage,
	scanWinners,
	setStage,
	type Stage,
} from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { agentEnabled } from "@/lib/specAuthor";
import { lookup, TrendtrackDisabledError, trendtrackEnabled, usage } from "@/lib/trendtrack";

const NO_TRENDTRACK = "TrendTrack indisponível: configure TRENDTRACK_API_KEY no servidor";
const NO_SOURCE =
	"nenhuma fonte de busca ligada: configure TRENDTRACK_API_KEY e/ou META_AD_LIBRARY_TOKEN — ou adicione anúncios pelo link (manual)";

const manualSchema = z.object({ sourceUrl: z.string().url(), advertiser: z.string().max(120).optional() });

/** Rotas do pipeline "Concorrentes" (TrendTrack → criativo → rascunho na Meta). Ver lib/pipeline.ts. */
export async function competitorRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	/** O que está ligado — a UI pinta os 3 cartões (TrendTrack / geração / Meta) a partir disso. */
	app.get("/pipeline/status", async () => {
		let credits: number | null = null;
		let trendtrackError: string | null = null;
		if (trendtrackEnabled()) {
			try {
				credits = (await usage()).totalRemaining;
			} catch (err) {
				trendtrackError = err instanceof Error ? err.message : String(err);
			}
		}

		return {
			trendtrack: { enabled: trendtrackEnabled(), credits, error: trendtrackError },
			adLibrary: { enabled: adLibraryEnabled() },
			ai: { enabled: agentEnabled() },
			broll: { providers: enabledProviders() },
			meta: { enabled: metaEnabled() },
		};
	});

	/** Acha a página de um concorrente por nome, domínio, id de página ou @ do Instagram. Grátis. */
	app.get<{ Querystring: { q?: string } }>("/trendtrack/lookup", async (request, reply) => {
		const q = request.query.q?.trim();
		if (!q) return reply.code(400).send({ error: "informe ?q=" });
		try {
			return await lookup(q);
		} catch (err) {
			if (err instanceof TrendtrackDisabledError) return reply.code(503).send({ error: NO_TRENDTRACK });

			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha no lookup" });
		}
	});

	app.get<{ Params: { id: string } }>("/apps/:id/pipeline", async (request, reply) => {
		const found = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "app não encontrado" });

		return readConfig(found.pipeline);
	});

	app.put<{ Params: { id: string } }>("/apps/:id/pipeline", async (request, reply) => {
		const parsed = pipelineConfigSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
		const found = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "app não encontrado" });

		await prisma.app.update({ where: { id: found.id }, data: { pipeline: parsed.data as object } });

		return parsed.data;
	});

	/**
	 * 01 — varre as fontes ligadas (TrendTrack e/ou Biblioteca oficial). No TrendTrack gasta
	 * crédito por linha devolvida (limitado por `perSource`); a Biblioteca é grátis.
	 */
	app.post<{ Params: { id: string } }>("/apps/:id/competitors/scan", async (request, reply) => {
		if (!trendtrackEnabled() && !adLibraryEnabled()) return reply.code(503).send({ error: NO_SOURCE });
		const found = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "app não encontrado" });
		const cfg = readConfig(found.pipeline);
		if (cfg.competitors.length === 0 && cfg.keywords.length === 0) {
			return reply.code(400).send({ error: "adicione ao menos um concorrente ou termo de busca" });
		}

		return scanWinners(found.id);
	});

	/**
	 * 01 — fonte manual: link de um anúncio (Biblioteca da Meta, Instagram, TikTok...) em JSON,
	 * ou o vídeo em multipart. Entra direto na etapa 02 — uma pessoa escolheu.
	 */
	app.post<{ Params: { id: string } }>("/apps/:id/competitor-ads/manual", async (request, reply) => {
		const found = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "app não encontrado" });

		if (request.isMultipart()) {
			const file = await request.file();
			if (!file) return reply.code(400).send({ error: "nenhum arquivo enviado" });
			const dir = join(env.STORAGE_DIR, "references", "uploads");
			await mkdir(dir, { recursive: true });
			const filePath = join(dir, `${crypto.randomUUID()}${extname(file.filename) || ".mp4"}`);
			await pipeline(file.file, createWriteStream(filePath));
			if (file.file.truncated) return reply.code(413).send({ error: "arquivo excede o limite de upload" });
			const advertiser = (file.fields.advertiser as { value?: string } | undefined)?.value;

			return reply.code(201).send(await addManual(found.id, request.user.sub, { filePath, advertiser }));
		}

		const parsed = manualSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: "envie { sourceUrl } (link do anúncio) ou o vídeo" });

		return reply.code(201).send(await addManual(found.id, request.user.sub, parsed.data));
	});

	app.get<{ Params: { id: string } }>("/apps/:id/competitor-ads", async (request) => {
		return prisma.competitorAd.findMany({
			where: { appId: request.params.id, stage: { not: "DISMISSED" } },
			orderBy: [{ reach: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
			include: { creative: { select: { id: true, name: true } } },
		});
	});

	/** Transições humanas. O resto o laço (lib/pipeline.ts) faz sozinho. */
	async function transition(id: string, from: Stage[], to: Stage, reply: FastifyReply) {
		const row = await prisma.competitorAd.findUnique({ where: { id } });
		if (!row) return reply.code(404).send({ error: "anúncio não encontrado" });
		if (!from.includes(row.stage as Stage)) {
			return reply.code(409).send({ error: `não dá pra fazer isso com o anúncio em ${row.stage}` });
		}
		await setStage(row.id, to);

		return prisma.competitorAd.findUnique({ where: { id: row.id } });
	}

	app.post<{ Params: { id: string } }>("/competitor-ads/:id/recreate", (request, reply) =>
		transition(request.params.id, ["SPOTTED"], "QUEUED", reply),
	);

	app.post<{ Params: { id: string } }>("/competitor-ads/:id/dismiss", (request, reply) =>
		transition(request.params.id, ["SPOTTED", "FAILED", "READY"], "DISMISSED", reply),
	);

	/** 03 — enfileira o envio pra Meta (anúncio PAUSADO). O upload roda no laço: leva minutos. */
	app.post<{ Params: { id: string } }>("/competitor-ads/:id/meta-draft", async (request, reply) => {
		if (!metaEnabled()) {
			return reply.code(503).send({ error: "Meta Ads indisponível: configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID" });
		}

		return transition(request.params.id, ["READY"], "DRAFT_QUEUED", reply);
	});

	app.post<{ Params: { id: string } }>("/competitor-ads/:id/retry", async (request, reply) => {
		const row = await prisma.competitorAd.findUnique({ where: { id: request.params.id } });
		if (!row) return reply.code(404).send({ error: "anúncio não encontrado" });
		if (row.stage !== "FAILED") return reply.code(409).send({ error: "só dá pra tentar de novo o que falhou" });
		const { stage, patch } = await resumeStage(row);
		await setStage(row.id, stage, patch);

		return prisma.competitorAd.findUnique({ where: { id: row.id } });
	});

	/** "Recriar todos": manda pra fila todos os vencedores ainda não trabalhados. */
	app.post<{ Params: { id: string } }>("/apps/:id/competitor-ads/recreate-all", async (request) => {
		const res = await prisma.competitorAd.updateMany({
			where: { appId: request.params.id, stage: "SPOTTED" },
			data: { stage: "QUEUED" },
		});

		return { queued: res.count };
	});
}
