import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const linkSchema = z.object({ sourceUrl: z.string().url() });

/** Where a reference's uploads and extracted frames live, under the shared media volume. */
const refDir = (id: string): string => join(env.STORAGE_DIR, "references", id);
const uploadsDir = (): string => join(env.STORAGE_DIR, "references", "uploads");

export async function referenceRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	/**
	 * Submit a reference — either an uploaded video (multipart) or a link (JSON body).
	 * The row starts QUEUED; the worker picks it up, extracts frames + audio, and flips it
	 * to READY. Ingestion is deliberately not done inline: it is slow and CPU-heavy, and the
	 * caller should get an id back immediately.
	 */
	app.post<{ Params: { id: string } }>("/apps/:id/references", async (request, reply) => {
		const targetApp = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!targetApp) return reply.code(404).send({ error: "app não encontrado" });

		let sourceUrl: string | null = null;
		let filePath: string | null = null;

		if (request.isMultipart()) {
			const file = await request.file();
			if (!file) return reply.code(400).send({ error: "nenhum arquivo enviado" });

			await mkdir(uploadsDir(), { recursive: true });
			const ext = extname(file.filename) || ".mp4";
			filePath = join(uploadsDir(), `${crypto.randomUUID()}${ext}`);
			await pipeline(file.file, createWriteStream(filePath));

			// @fastify/multipart truncates silently past the limit; a half file would fail deep
			// in ffmpeg with a confusing error, so catch it here.
			if (file.file.truncated) {
				return reply.code(413).send({ error: "arquivo excede o limite de upload" });
			}
		} else {
			const parsed = linkSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.code(400).send({ error: "envie um arquivo (multipart) ou { sourceUrl }" });
			}
			sourceUrl = parsed.data.sourceUrl;
		}

		const reference = await prisma.referenceAsset.create({
			data: { appId: targetApp.id, userId: request.user.sub, sourceUrl, filePath, status: "QUEUED" },
		});

		return reply.code(201).send(reference);
	});

	app.get<{ Params: { id: string } }>("/apps/:id/references", async (request) => {
		return prisma.referenceAsset.findMany({
			where: { appId: request.params.id },
			orderBy: { createdAt: "desc" },
		});
	});

	app.get<{ Params: { id: string } }>("/references/:id", async (request, reply) => {
		const found = await prisma.referenceAsset.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "referência não encontrada" });

		return found;
	});

	/** Serves one extracted frame. `file` is a basename only — no path segments allowed. */
	app.get<{ Params: { id: string; file: string } }>(
		"/references/:id/frames/:file",
		async (request, reply) => {
			const { id, file } = request.params;
			// Path-traversal guard: the manifest only ever produces `NN_<time>s.jpg`.
			if (!/^[\w.-]+\.jpg$/.test(file)) return reply.code(400).send({ error: "nome inválido" });

			try {
				const buf = await readFile(join(refDir(id), "frames", file));

				return reply.type("image/jpeg").send(buf);
			} catch {
				return reply.code(404).send({ error: "frame não encontrado" });
			}
		},
	);
}
