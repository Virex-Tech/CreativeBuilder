import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { assetsDir } from "@/lib/assets";
import { env } from "@/lib/env";

/**
 * Serve os assets de b-roll baixados. Público de propósito (sem auth): o render (Chrome
 * headless) e o preview no navegador precisam carregar a URL, e nenhum deles manda o JWT.
 * O nome é um UUID não-adivinhável e há guarda de path traversal — só b-roll gerado, nada
 * sensível. NÃO registra o hook de authenticate.
 */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
	app.get<{ Params: { file: string } }>("/assets/:file", async (request, reply) => {
		const { file } = request.params;
		if (!/^[\w-]+\.(mp4|webm|mov|m4v|png|jpg|jpeg)$/i.test(file)) {
			return reply.code(400).send({ error: "nome inválido" });
		}
		const path = join(assetsDir(), file);
		try {
			const info = await stat(path);
			const type = /\.(png|jpe?g)$/i.test(file)
				? "image/jpeg"
				: file.endsWith(".webm")
					? "video/webm"
					: "video/mp4";

			reply.header("Accept-Ranges", "bytes").header("Cache-Control", "public, max-age=3600").type(type);

			// Range: sem isso o navegador não consegue pular pro meio do vídeo — e o preview de um
			// take cortado começa justamente no meio (startFromMs).
			const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
			if (range && (range[1] || range[2])) {
				const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
				const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
				if (start >= info.size || start > end) {
					return reply.code(416).header("Content-Range", `bytes */${info.size}`).send();
				}

				return reply
					.code(206)
					.header("Content-Range", `bytes ${start}-${end}/${info.size}`)
					.header("Content-Length", end - start + 1)
					.send(createReadStream(path, { start, end }));
			}

			return reply.header("Content-Length", info.size).send(createReadStream(path));
		} catch {
			return reply.code(404).send({ error: "asset não encontrado" });
		}
	});

	/**
	 * Frames de referência (miniatura no calendário). Mesma lógica do /assets: público, id UUID
	 * não-adivinhável, só nome de arquivo no formato que a ingestão gera.
	 */
	app.get<{ Params: { id: string; file: string } }>("/ref-frames/:id/:file", async (request, reply) => {
		const { id, file } = request.params;
		if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[\w.-]+\.jpg$/.test(file)) return reply.code(400).send({ error: "nome inválido" });
		const path = join(env.STORAGE_DIR, "references", id, "frames", file);
		try {
			const info = await stat(path);

			return reply
				.header("Content-Length", info.size)
				.header("Cache-Control", "public, max-age=86400")
				.type("image/jpeg")
				.send(createReadStream(path));
		} catch {
			return reply.code(404).send({ error: "frame não encontrado" });
		}
	});
}
