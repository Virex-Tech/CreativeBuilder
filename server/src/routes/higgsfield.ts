import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { generateVideo, higgsfieldEnabled } from "@/lib/higgsfield";
import { prisma } from "@/lib/prisma";
import { reflow, specHash, type Spec } from "@/lib/spec";

const testSchema = z.object({ prompt: z.string().min(1) });

interface GenerativeLayer {
	type: string;
	prompt?: string;
	src?: string;
	[key: string]: unknown;
}

/** Rotas da Fase 3 — b-roll no Higgsfield. Inertes sem credenciais (503). */
export async function higgsfieldRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	/**
	 * Teste barato de conectividade: gera UM vídeo a partir de um prompt e devolve a URL.
	 * É o jeito de validar credencial + endpoint do modelo antes de ligar o b-roll de verdade.
	 */
	app.post("/higgsfield/test", async (request, reply) => {
		if (!higgsfieldEnabled()) {
			return reply.code(503).send({
				error: "Higgsfield indisponível: configure HIGGSFIELD_API_KEY_ID, HIGGSFIELD_API_KEY_SECRET e HIGGSFIELD_VIDEO_ENDPOINT",
			});
		}
		const parsed = testSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		try {
			const out = await generateVideo(parsed.data.prompt);

			return { ok: true, url: out.url, requestId: out.requestId };
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha na geração" });
		}
	});

	/**
	 * Gera o b-roll de todas as camadas `generative_video` pendentes (sem `src`) do criativo,
	 * preenche o `src` com a URL do Higgsfield e grava uma nova versão do spec.
	 *
	 * A URL do provedor expira em ~7 dias — para arquivar, baixar e servir localmente (TODO:
	 * requer o render enxergar /media; hoje o render carrega URL http direto via resolveSrc).
	 * Sequencial de propósito: cada geração custa créditos e ~45s; um teto evita loop absurdo.
	 */
	app.post<{ Params: { id: string } }>("/creatives/:id/broll", async (request, reply) => {
		if (!higgsfieldEnabled()) {
			return reply.code(503).send({
				error: "Higgsfield indisponível: configure HIGGSFIELD_API_KEY_ID, HIGGSFIELD_API_KEY_SECRET e HIGGSFIELD_VIDEO_ENDPOINT",
			});
		}

		const creative = await prisma.creative.findUnique({ where: { id: request.params.id } });
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		const current = await prisma.creativeVersion.findFirst({
			where: { creativeId: creative.id },
			orderBy: { version: "desc" },
		});
		if (!current) return reply.code(409).send({ error: "criativo sem versão" });

		const spec = current.spec as unknown as Spec;
		const pending: GenerativeLayer[] = [];
		for (const scene of spec.scenes) {
			for (const raw of scene.layers) {
				const layer = raw as GenerativeLayer;
				if (layer.type === "generative_video" && layer.prompt && !layer.src) pending.push(layer);
			}
		}

		if (pending.length === 0) {
			return { unchanged: true, generated: 0, message: "nenhuma camada generative_video pendente" };
		}
		const MAX = 6;
		const batch = pending.slice(0, MAX);

		let generated = 0;
		try {
			for (const layer of batch) {
				const out = await generateVideo(layer.prompt as string);
				layer.src = out.url;
				generated++;
			}
		} catch (err) {
			// Se já geramos algumas, salva o progresso mesmo assim (créditos não se perdem).
			if (generated === 0) {
				return reply.code(502).send({ error: err instanceof Error ? err.message : "falha na geração" });
			}
		}

		const next = reflow(spec);
		const version = await prisma.creativeVersion.create({
			data: {
				creativeId: creative.id,
				version: current.version + 1,
				spec: next as object,
				specHash: specHash(next),
				createdBy: "ai",
				note: `b-roll higgsfield (${generated}/${pending.length})`,
			},
		});

		return { version, generated, pending: pending.length, truncated: pending.length > MAX };
	});
}
