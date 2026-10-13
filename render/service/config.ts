import { resolve } from "node:path";

import { parseRewriteRules, type RewriteRule } from "../src/urlRewrite";

/** Env of the render service. Parsed once at boot; a bad value fails the boot, not a render. */
export interface Config {
	port: number;
	outDir: string;
	/** Chrome tabs per render (Remotion `concurrency`); null = Remotion's default. */
	concurrency: number | null;
	/**
	 * Ceiling for every delayRender() of a render — media fetch/decoding (OffthreadVideo, Img, Audio,
	 * the app-screen aspect probe). Remotion's 30 s default fails under host load on remote takes.
	 */
	mediaTimeoutMs: number;
	/** Renders running at once; the rest wait in a FIFO queue. */
	maxJobs: number;
	/** Finished jobs (and their files) live this long. 0 = forever (no prune, no sweep). */
	ttlMs: number;
	/** Bearer token required on every route but /health and /preview/*. Empty = open. */
	token: string;
	urlRewrite: RewriteRule[];
	/** Origins allowed to drive /preview/ via postMessage (and to frame it). Empty = same origin. */
	previewOrigins: string[];
	previewDir: string;
	publicDir: string;
}

function num(name: string, fallback: number, min: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw.trim() === "") return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n) || n < min) throw new Error(`${name} inválido: "${raw}" (número >= ${min})`);

	return n;
}

export function loadConfig(): Config {
	return {
		port: num("PORT", 11100, 1),
		outDir: resolve(process.env.RENDER_OUT_DIR ?? "out"),
		concurrency: process.env.RENDER_CONCURRENCY ? num("RENDER_CONCURRENCY", 1, 1) : null,
		mediaTimeoutMs: Math.floor(num("RENDER_MEDIA_TIMEOUT_MS", 120_000, 5_000)),
		maxJobs: Math.floor(num("RENDER_MAX_JOBS", 1, 1)),
		ttlMs: num("RENDER_OUT_TTL_HOURS", 24, 0) * 3600_000,
		token: (process.env.RENDER_TOKEN ?? "").trim(),
		urlRewrite: parseRewriteRules(process.env.RENDER_URL_REWRITE),
		previewOrigins: (process.env.PREVIEW_ALLOWED_ORIGINS ?? "")
			.split(",")
			.map((o) => o.trim().replace(/\/+$/, ""))
			.filter(Boolean),
		previewDir: resolve(process.env.PREVIEW_DIR ?? "preview-dist"),
		publicDir: resolve("public"),
	};
}
