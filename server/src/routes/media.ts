import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { assetsDir } from "@/lib/assets";

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

			return reply.header("Content-Length", info.size).type(type).send(createReadStream(path));
		} catch {
			return reply.code(404).send({ error: "asset não encontrado" });
		}
	});
}
