import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { downloadAsset } from "@/lib/assets";
import { BROLL_PROVIDERS, enabledProviders, generateVideo, resolveProvider } from "@/lib/broll";
import { prisma } from "@/lib/prisma";
import { reflow, specHash, type Spec } from "@/lib/spec";

const providerSchema = z.enum(BROLL_PROVIDERS).optional();
const testSchema = z.object({ prompt: z.string().min(1), provider: providerSchema });
const brollSchema = z.object({ provider: providerSchema }).optional();

interface GenerativeLayer {
	type: string;
	prompt?: string;
	src?: string;
	[key: string]: unknown;
}

const NO_PROVIDER =
	"nenhum provedor de b-roll configurado: sete KIE_API_KEY (kie.ai) ou HIGGSFIELD_API_KEY_ID/SECRET + HIGGSFIELD_VIDEO_ENDPOINT";

/** Rotas da Fase 3 — b-roll. Provedor selecionável (Higgsfield ou kie.ai). Inertes sem credenciais. */
export async function brollRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	/** Quais provedores estão habilitados + qual é o default — a UI usa pra montar o seletor. */
	app.get("/broll/providers", async () => {
		const enabled = enabledProviders();

		return {
			providers: BROLL_PROVIDERS.map((id) => ({ id, enabled: enabled.includes(id) })),
			default: resolveProvider(),
		};
	});

	/**
	 * Teste barato de conectividade: gera UM vídeo a partir de um prompt e devolve a URL.
	 * É o jeito de validar credencial + provedor antes de ligar o b-roll de verdade.
	 */
	app.post("/broll/test", async (request, reply) => {
		const parsed = testSchema.safeParse(request.body ?? {});
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const provider = resolveProvider(parsed.data.provider);
		if (!provider) return reply.code(503).send({ error: NO_PROVIDER });

		try {
			const out = await generateVideo(provider, parsed.data.prompt);

			return { ok: true, provider, url: out.url, requestId: out.requestId };
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha na geração" });
		}
	});

	/**
	 * Gera o b-roll de todas as camadas `generative_video` pendentes (sem `src`) do criativo,
	 * preenche o `src` com a URL do provedor e grava uma nova versão do spec.
	 *
	 * A URL do provedor pode expirar — por isso baixamos o asset pra /media e servimos por uma
	 * URL local que não expira (quando PUBLIC_API_BASE está setado).
	 * Sequencial de propósito: cada geração custa créditos e ~45s; um teto evita loop absurdo.
	 */
	app.post<{ Params: { id: string } }>("/creatives/:id/broll", async (request, reply) => {
		const parsedBody = brollSchema.safeParse(request.body ?? {});
		if (!parsedBody.success) return reply.code(400).send({ error: parsedBody.error.format() });

		const provider = resolveProvider(parsedBody.data?.provider);
		if (!provider) return reply.code(503).send({ error: NO_PROVIDER });

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
				const out = await generateVideo(provider, layer.prompt as string);
				// Baixa o asset pra /media e usa a URL local (não expira). Se o download ou o
				// PUBLIC_API_BASE não estiverem disponíveis, cai na URL do provedor.
				let src = out.url;
				try {
					const saved = await downloadAsset(out.url);
					if (saved.publicUrl) src = saved.publicUrl;
				} catch {
					// mantém a URL do provedor
				}
				layer.src = src;
				layer.provider = provider;
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
				note: `b-roll ${provider} (${generated}/${pending.length})`,
			},
		});

		return { version, provider, generated, pending: pending.length, truncated: pending.length > MAX };
	});
}
