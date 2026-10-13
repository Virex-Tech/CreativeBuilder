import { env } from "@/lib/env";

/**
 * Lista os vídeos de uma pasta do Google Drive compartilhada como "qualquer pessoa com o link".
 *
 * Com GOOGLE_API_KEY usa a Drive API (robusto, pagina). Sem ela, lê a página pública
 * `embeddedfolderview` — a mesma que o Google usa pra embutir pasta num site. Funciona sem
 * nenhuma credencial, mas depende do HTML deles; por isso a chave é o caminho recomendado.
 * Pasta privada não aparece por nenhum dos dois: o erro diz como compartilhar.
 */

export interface DriveFile {
	id: string;
	name: string;
}

const VIDEO_NAME = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i;

export function driveFolderId(url: string): string | null {
	const m = url.match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=|embeddedfolderview\?id=)([\w-]{10,})/);
	if (m) return m[1];

	return /^[\w-]{20,}$/.test(url.trim()) ? url.trim() : null;
}

async function viaApi(folderId: string): Promise<DriveFile[]> {
	const files: DriveFile[] = [];
	let pageToken: string | undefined;
	do {
		const params = new URLSearchParams({
			q: `'${folderId}' in parents and trashed = false and mimeType contains 'video/'`,
			fields: "nextPageToken, files(id, name)",
			pageSize: "200",
			orderBy: "name",
			key: env.GOOGLE_API_KEY as string,
		});
		if (pageToken) params.set("pageToken", pageToken);
		const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
		const body = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string; error?: { message?: string } };
		if (!res.ok) throw new Error(`Drive: ${body.error?.message ?? `HTTP ${res.status}`}`);
		files.push(...(body.files ?? []));
		pageToken = body.nextPageToken;
	} while (pageToken);

	return files;
}

async function viaPublicPage(folderId: string): Promise<DriveFile[]> {
	const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`);
	if (!res.ok) {
		throw new Error('pasta do Drive não encontrada — confira o link e se ela está compartilhada como "qualquer pessoa com o link"');
	}
	const html = await res.text();
	const files: DriveFile[] = [];
	// Cada item: <a href="https://drive.google.com/file/d/<id>/view..."> ... <div class="flip-entry-title">nome</div>
	for (const m of html.matchAll(/file\/d\/([\w-]{20,})[\s\S]*?flip-entry-title">([^<]+)</g)) {
		files.push({ id: m[1], name: m[2].trim() });
	}

	return files.filter((f) => VIDEO_NAME.test(f.name));
}

export async function listDriveVideos(folderUrl: string): Promise<DriveFile[]> {
	const id = driveFolderId(folderUrl);
	if (!id) throw new Error("link de pasta do Drive não reconhecido (esperado drive.google.com/drive/folders/...)");
	const files = env.GOOGLE_API_KEY ? await viaApi(id) : await viaPublicPage(id);
	if (files.length === 0) {
		throw new Error('nenhum vídeo na pasta — ela está compartilhada como "qualquer pessoa com o link"?');
	}

	return files;
}
