import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { env } from "@/lib/env";

/**
 * Baixa um asset gerado (b-roll do Higgsfield) para o volume de mídia, para que o spec deixe
 * de depender da URL do provedor — que expira em ~7 dias. Devolve o nome do arquivo e a URL
 * pública (servida por GET /assets/:file) quando PUBLIC_API_BASE está setado.
 */
export function assetsDir(): string {
	return join(env.STORAGE_DIR, "assets");
}

/**
 * Baixa `url` para STORAGE_DIR/assets e retorna { file, publicUrl }. Se PUBLIC_API_BASE não
 * estiver setado, `publicUrl` é null e o chamador deve manter a URL original no spec.
 */
export async function downloadAsset(url: string): Promise<{ file: string; publicUrl: string | null }> {
	const dir = assetsDir();
	await mkdir(dir, { recursive: true });

	const ext = extname(new URL(url).pathname) || ".mp4";
	const file = `${crypto.randomUUID()}${ext}`;
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) throw new Error(`falha ao baixar asset (HTTP ${res.status})`);

	await pipeline(
		Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
		createWriteStream(join(dir, file)),
	);

	const publicUrl = env.PUBLIC_API_BASE ? `${env.PUBLIC_API_BASE.replace(/\/$/, "")}/assets/${file}` : null;

	return { file, publicUrl };
}
