import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { appRoutes } from "@/routes/apps";
import { authRoutes } from "@/routes/auth";
import { brollRoutes } from "@/routes/broll";
import { codexRoutes } from "@/routes/codex";
import { creativeRoutes } from "@/routes/creatives";
import { mediaRoutes } from "@/routes/media";
import { metricsRoutes } from "@/routes/metrics";
import { referenceRoutes } from "@/routes/references";
import { renderRoutes } from "@/routes/render";

declare module "fastify" {
	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}

declare module "@fastify/jwt" {
	interface FastifyJWT {
		payload: { sub: string; email: string; role: string };
		user: { sub: string; email: string; role: string };
	}
}

export function buildServer() {
	const app = Fastify({
		logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
	});

	void app.register(cors, {
		origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
		credentials: true,
	});

	void app.register(jwt, {
		secret: env.JWT_SECRET,
		sign: { expiresIn: env.JWT_EXPIRATION },
	});

	// Reference uploads are the only large bodies; keep the ceiling generous but finite so a
	// stray upload cannot fill the disk. nginx also caps this at the edge (client_max_body_size).
	void app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024, files: 1 } });

	app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			await request.jwtVerify();
		} catch {
			await reply.code(401).send({ error: "token inválido ou ausente" });
		}
	});

	app.get("/health", async () => {
		// Report the database too: an API answering 200 while Postgres is down is a lie that
		// makes a deploy look healthy right up until the first real request.
		try {
			await prisma.$queryRaw`SELECT 1`;

			return { ok: true, db: true };
		} catch {
			return { ok: false, db: false };
		}
	});

	void app.register(authRoutes);
	void app.register(codexRoutes);
	void app.register(appRoutes);
	void app.register(creativeRoutes);
	void app.register(renderRoutes);
	void app.register(referenceRoutes);
	void app.register(brollRoutes);
	void app.register(metricsRoutes);
	void app.register(mediaRoutes);

	return app;
}

async function main(): Promise<void> {
	const app = buildServer();
	await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

if (require.main === module) {
	main().catch((err: unknown) => {
		console.error(err);
		process.exit(1);
	});
}
