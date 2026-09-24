import { resolve } from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { type CreativeSpec } from "../src/spec";
import { rewriteSpecUrls, type RewriteRule } from "../src/urlRewrite";

/**
 * The bundle is built ONCE and reused for every render.
 *
 * Bundling is the slow part (tens of seconds); doing it per request would dominate render
 * time. It is cached as a promise so concurrent first requests share one build instead of
 * racing to produce several. A failed build is not cached — the next render retries it.
 */
let bundlePromise: Promise<string> | null = null;

export function getBundle(): Promise<string> {
	bundlePromise ??= bundle({
		entryPoint: resolve("src/index.ts"),
		onProgress: () => undefined,
	}).catch((err: unknown) => {
		bundlePromise = null;
		throw err;
	});

	return bundlePromise;
}

export interface RenderOptions {
	concurrency: number | null;
	urlRewrite: RewriteRule[];
}

async function resolveComposition(spec: CreativeSpec) {
	const serveUrl = await getBundle();

	// calculateMetadata in Root.tsx derives width/height/fps/duration from the spec, so the
	// composition is resolved per request rather than assumed.
	const composition = await selectComposition({
		serveUrl,
		id: "Creative",
		inputProps: { spec },
	});

	return { serveUrl, composition };
}

/** Server-side only: public URLs → internal ones (RENDER_URL_REWRITE). Never in the preview. */
const forServer = (spec: CreativeSpec, opts: RenderOptions): CreativeSpec => rewriteSpecUrls(spec, opts.urlRewrite);

export async function renderVideo(
	spec: CreativeSpec,
	outPath: string,
	opts: RenderOptions,
	onProgress: (percent: number) => void,
): Promise<void> {
	const input = forServer(spec, opts);
	const { serveUrl, composition } = await resolveComposition(input);

	await renderMedia({
		serveUrl,
		composition,
		codec: "h264",
		outputLocation: outPath,
		inputProps: { spec: input },
		concurrency: opts.concurrency,
		onProgress: ({ progress }) => onProgress(Math.round(progress * 100)),
	});
}

export async function renderStillFrame(spec: CreativeSpec, frame: number, outPath: string, opts: RenderOptions): Promise<void> {
	const input = forServer(spec, opts);
	const { serveUrl, composition } = await resolveComposition(input);

	await renderStill({
		serveUrl,
		composition,
		output: outPath,
		inputProps: { spec: input },
		frame: Math.max(0, Math.min(Math.floor(frame), composition.durationInFrames - 1)),
	});
}
