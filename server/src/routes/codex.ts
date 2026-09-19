import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
	codexEnabled,
	codexLoginStatus,
	codexTest,
	currentDeviceCode,
	startDeviceLogin,
} from "@/lib/codexClient";
import { env } from "@/lib/env";

/**
 * Conectar o provider de IA (Codex) pela plataforma, sem CLI do lado do usuário.
 *
 * O admin clica "Conectar Codex": a API roda `codex login --device-auth`, devolve o link + o
 * código de uso único e o admin autoriza no navegador com a conta ChatGPT. O token é gravado
 * no CODEX_HOME montado no container. Só admin — é uma credencial do servidor inteiro.
 */
export async function codexRoutes(app: FastifyInstance): Promise<void> {
	/** Bloqueia não-admin; retorna false já tendo respondido 403. */
	function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
		if (request.user.role !== "ADMIN") {
			void reply.code(403).send({ error: "somente admin pode gerenciar a conexão da IA" });

			return false;
		}

		return true;
	}

	app.get("/codex/status", { onRequest: [app.authenticate] }, async (request, reply) => {
		if (!requireAdmin(request, reply)) return;

		return { provider: env.AI_PROVIDER, status: codexLoginStatus(), device: currentDeviceCode() };
	});

	app.post("/codex/login", { onRequest: [app.authenticate] }, async (request, reply) => {
		if (!requireAdmin(request, reply)) return;
		if (env.AI_PROVIDER !== "codex") {
			return reply.code(409).send({ error: "AI_PROVIDER não é 'codex' — nada a conectar" });
		}
		if (codexEnabled()) return { status: "connected" as const };

		try {
			const device = await startDeviceLogin();

			return { status: "pending" as const, ...device };
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha ao iniciar login" });
		}
	});

	app.post("/codex/test", { onRequest: [app.authenticate] }, async (request, reply) => {
		if (!requireAdmin(request, reply)) return;
		if (!codexEnabled()) return reply.code(503).send({ error: "Codex não conectado" });

		try {
			const sample = await codexTest();

			return { ok: true, sample: sample.slice(0, 200) };
		} catch (err) {
			return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : "falha no teste" });
		}
	});
}
