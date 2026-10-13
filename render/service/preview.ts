import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

import type { FastifyInstance, FastifyReply } from "fastify";

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".mp4": "video/mp4",
	".m4v": "video/mp4",
	".mov": "video/quicktime",
	".webm": "video/webm",
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
};

/** Resolves `rel` inside `root`, refusing traversal, dotfiles and anything under `deny`. */
function safeJoin(root: string, rel: string, deny: string[] = []): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(rel);
	} catch {
		return null;
	}
	const clean = normalize(decoded).replace(/^([/\\])+/, "");
	if (!clean || clean.startsWith("..") || clean.split(/[/\\]/).some((p) => p.startsWith("."))) return null;
	if (deny.some((d) => clean === d || clean.startsWith(d + "/") || clean.startsWith(d + sep))) return null;
	const full = join(root, clean);

	return full.startsWith(root + sep) ? full : null;
}

/** Streams a file with Range support (the browser's <video> seeks with byte ranges). */
async function sendFile(reply: FastifyReply, file: string | null, range: string | undefined, cache: string): Promise<FastifyReply> {
	if (!file) return reply.code(404).send({ error: "not found" });
	let size: number;
	try {
		const st = await stat(file);
		if (!st.isFile()) return reply.code(404).send({ error: "not found" });
		size = st.size;
	} catch {
		return reply.code(404).send({ error: "not found" });
	}

	reply.header("Content-Type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
	reply.header("Accept-Ranges", "bytes");
	reply.header("Cache-Control", cache);

	const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
	if (m && (m[1] || m[2])) {
		let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
		let end = m[1] && m[2] ? Number(m[2]) : size - 1;
		end = Math.min(end, size - 1);
		if (start > end || start >= size) {
			return reply.code(416).header("Content-Range", `bytes */${size}`).send();
		}
		start = Math.max(0, start);
		reply.code(206).header("Content-Range", `bytes ${start}-${end}/${size}`).header("Content-Length", end - start + 1);

		return reply.send(createReadStream(file, { start, end }));
	}

	reply.header("Content-Length", size);

	return reply.send(createReadStream(file));
}

export interface PreviewOptions {
	previewDir: string;
	publicDir: string;
	/** From PREVIEW_ALLOWED_ORIGINS. Empty = same origin only; ["*"] = any (explicit opt-in). */
	origins: string[];
}

/**
 * GET /preview/ — static player page (built by `npm run build:preview` into preview-dist/).
 *
 * Every URL inside the page is RELATIVE (`./main.js`, `./config.js`, `./public/...`) so it works
 * behind a path prefix (PayPosts proxies it at /engine/preview/). `config.js` carries the allowed
 * origins; the same list goes into `frame-ancestors`, so only those sites can embed the page.
 */
export function registerPreview(app: FastifyInstance, opts: PreviewOptions): void {
	const any = opts.origins.includes("*");
	const frameAncestors = any ? "*" : ["'self'", ...opts.origins].join(" ");
	const config = `window.__CE_CONFIG__ = ${JSON.stringify({ allowedOrigins: opts.origins })};\n`;

	// Relative Location: "/preview" → "preview/" also lands right under a proxy prefix.
	app.get("/preview", async (_request, reply) => reply.redirect("preview/", 301));

	app.get("/preview/config.js", async (_request, reply) =>
		reply.type("text/javascript; charset=utf-8").header("Cache-Control", "no-store").send(config),
	);

	app.get<{ Params: { "*": string } }>("/preview/public/*", async (request, reply) =>
		// Recorded takes (a real person's face and voice) are never served, even if present.
		sendFile(reply, safeJoin(opts.publicDir, request.params["*"], ["takes"]), request.headers.range, "public, max-age=300"),
	);

	app.get<{ Params: { "*": string } }>("/preview/*", async (request, reply) => {
		const rel = request.params["*"] || "index.html";
		const isIndex = rel === "index.html";
		if (isIndex) {
			reply.header("Content-Security-Policy", `frame-ancestors ${frameAncestors}`);
		}

		return sendFile(reply, safeJoin(opts.previewDir, rel), request.headers.range, isIndex ? "no-store" : "public, max-age=300");
	});
}
