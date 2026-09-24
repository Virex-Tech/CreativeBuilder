import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";

/** Routes that never need the token: liveness and the (iframe-embedded) preview page. */
export function isPublicRoute(method: string, url: string): boolean {
	const path = url.split("?")[0];
	if (method === "GET" || method === "HEAD") {
		return path === "/health" || path === "/preview" || path.startsWith("/preview/");
	}

	return false;
}

function sameToken(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);

	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * `Authorization: Bearer <RENDER_TOKEN>` on every route but GET /health and GET /preview/*.
 * No token configured = open (CreativeBuilder's render sits on a private network today).
 */
export function registerAuth(app: FastifyInstance, token: string): void {
	if (!token) return;

	app.addHook("onRequest", async (request, reply) => {
		if (isPublicRoute(request.method, request.url)) return;
		const header = request.headers.authorization ?? "";
		const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!given || !sameToken(given, token)) {
			return reply.code(401).send({ error: "unauthorized" });
		}
	});
}
