import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { computeMetrics, parseCsv, rowIdentifier, type ComputedMetrics } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { agentDisabledMessage, agentEnabled, diagnoseMetrics } from "@/lib/specAuthor";

const csvSchema = z.object({ csv: z.string().min(1) });

/** Casa o identificador da linha (id uuid ou nome do anúncio) a um criativo do app. */
function matchCreative(
	identifier: string,
	creatives: { id: string; name: string }[],
): { id: string; name: string } | null {
	const idn = identifier.trim().toLowerCase();
	return (
		creatives.find((c) => c.id.toLowerCase() === idn || c.name.toLowerCase() === idn) ??
		creatives.find((c) => idn.includes(c.id.toLowerCase()) || idn.includes(c.name.toLowerCase())) ??
		null
	);
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	/**
	 * Sobe um CSV do Gerenciador de Anúncios (upload ou { csv }), cruza cada linha com um
	 * criativo do app (pelo id ou nome do anúncio), calcula as métricas por posição e grava
	 * um snapshot em creative_metrics. Devolve o resumo ranqueado por hook rate.
	 */
	app.post<{ Params: { id: string } }>("/apps/:id/metrics", async (request, reply) => {
		const targetApp = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!targetApp) return reply.code(404).send({ error: "app não encontrado" });

		let csvText: string;
		if (request.isMultipart()) {
			const file = await request.file();
			if (!file) return reply.code(400).send({ error: "nenhum arquivo enviado" });
			const tmp = join(tmpdir(), `metrics-${crypto.randomUUID()}.csv`);
			await pipeline(file.file, createWriteStream(tmp));
			csvText = await readFile(tmp, "utf-8");
		} else {
			const parsed = csvSchema.safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "envie um arquivo (multipart) ou { csv }" });
			csvText = parsed.data.csv;
		}

		const rows = parseCsv(csvText);
		if (rows.length === 0) return reply.code(422).send({ error: "CSV vazio ou sem cabeçalho" });

		const creatives = await prisma.creative.findMany({
			where: { appId: targetApp.id },
			select: { id: true, name: true },
		});

		const capturedAt = new Date();
		const matched: { creativeId: string; name: string; metrics: ComputedMetrics }[] = [];
		let unmatched = 0;

		for (const row of rows) {
			const ident = rowIdentifier(row);
			const hit = ident ? matchCreative(ident, creatives) : null;
			if (!hit) {
				unmatched++;
				continue;
			}
			const metrics = computeMetrics(row);
			await prisma.creativeMetric.create({
				data: {
					creativeId: hit.id,
					source: "META_ADS_CSV",
					capturedAt,
					metrics: metrics as object,
				},
			});
			matched.push({ creativeId: hit.id, name: hit.name, metrics });
		}

		matched.sort((a, b) => (b.metrics.hookRate ?? -1) - (a.metrics.hookRate ?? -1));

		return reply.code(201).send({
			rows: rows.length,
			matched: matched.length,
			unmatched,
			summary: matched,
		});
	});

	/** Última leitura de métrica por criativo do app, ranqueada por hook rate. */
	app.get<{ Params: { id: string } }>("/apps/:id/metrics", async (request) => {
		const creatives = await prisma.creative.findMany({
			where: { appId: request.params.id },
			select: { id: true, name: true },
		});
		const byId = new Map(creatives.map((c) => [c.id, c]));
		const metrics = await prisma.creativeMetric.findMany({
			where: { creativeId: { in: creatives.map((c) => c.id) } },
			orderBy: { capturedAt: "desc" },
		});
		// Uma leitura por criativo (a mais recente).
		const latest = new Map<string, (typeof metrics)[number]>();
		for (const m of metrics) if (!latest.has(m.creativeId)) latest.set(m.creativeId, m);

		return [...latest.values()]
			.map((m) => ({ creativeId: m.creativeId, name: byId.get(m.creativeId)?.name, capturedAt: m.capturedAt, metrics: m.metrics }))
			.sort((a, b) => {
				const ha = (a.metrics as { hookRate?: number | null }).hookRate ?? -1;
				const hb = (b.metrics as { hookRate?: number | null }).hookRate ?? -1;

				return hb - ha;
			});
	});

	/** A 2ª IA: diagnostica o que deu certo e o que variar. Gated na ANTHROPIC_API_KEY. */
	app.post<{ Params: { id: string } }>("/apps/:id/metrics/diagnose", async (request, reply) => {
		if (!agentEnabled()) {
			return reply.code(503).send({ error: agentDisabledMessage("análise") });
		}
		const creatives = await prisma.creative.findMany({
			where: { appId: request.params.id },
			select: { id: true, name: true, mutation: true },
		});
		const byId = new Map(creatives.map((c) => [c.id, c]));
		const rows = await prisma.creativeMetric.findMany({
			where: { creativeId: { in: creatives.map((c) => c.id) } },
			orderBy: { capturedAt: "desc" },
		});
		if (rows.length === 0) return reply.code(409).send({ error: "sem métricas: suba um CSV primeiro" });

		const latest = new Map<string, (typeof rows)[number]>();
		for (const m of rows) if (!latest.has(m.creativeId)) latest.set(m.creativeId, m);
		const payload = [...latest.values()].map((m) => ({
			creative: byId.get(m.creativeId)?.name,
			mutation: byId.get(m.creativeId)?.mutation,
			metrics: m.metrics,
		}));

		try {
			const analysis = await diagnoseMetrics(payload);

			return { analysis };
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha na análise" });
		}
	});
}
