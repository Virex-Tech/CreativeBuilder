import { staticFile } from "remotion";

/**
 * Resolves an asset reference from a spec into something the renderer can load.
 *
 * Specs carry two kinds of source: a remote URL (a generated clip still sitting on the
 * provider's CDN, or one already in our bucket) and a local file living in `public/`.
 * Centralising this keeps the spec free of environment detail — the same spec renders on a
 * laptop and in a container without rewriting paths.
 *
 * Note for anything generated: provider URLs expire (Higgsfield outputs live ~7 days), so a
 * remote src is fine for a draft and wrong for anything archived. Download it and reference
 * the local copy before a spec is stored.
 */
export function resolveSrc(src: string): string {
	if (/^(https?:|data:|blob:)/i.test(src)) return src;

	return staticFile(src.replace(/^\/+/, ""));
}
