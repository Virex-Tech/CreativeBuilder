/**
 * Prefix rewrite of every media `src` in a spec — for SERVER-SIDE renders only.
 *
 * A spec carries the URLs the browser uses (`https://app.example/uploads/x.mp4`). Inside the
 * render container that public URL may be slow (hairpin through the internet), blocked, or
 * unreachable; the same file is on the internal network (`http://api:3000/uploads/x.mp4`).
 * `RENDER_URL_REWRITE="https://app.example/uploads/=>http://api:3000/uploads/;from2=>to2"` swaps
 * the prefix right before rendering. The stored spec and the browser preview keep the public URL.
 *
 * Pure and dependency-free (bundled into `lib/engine.mjs` too).
 */

export interface RewriteRule {
	from: string;
	to: string;
}

/** Parses `from=>to;from2=>to2`. Blank entries are ignored; a malformed one throws (fail at boot). */
export function parseRewriteRules(raw: string | undefined | null): RewriteRule[] {
	if (!raw || !raw.trim()) return [];

	return raw
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const i = part.indexOf("=>");
			const from = i === -1 ? "" : part.slice(0, i).trim();
			const to = i === -1 ? "" : part.slice(i + 2).trim();
			if (!from || !to) throw new Error(`RENDER_URL_REWRITE inválido: "${part}" (formato: de=>para;de2=>para2)`);

			return { from, to };
		});
}

/** First matching prefix wins; no match = unchanged. */
export function rewriteUrl(src: string, rules: readonly RewriteRule[]): string {
	for (const r of rules) if (src.startsWith(r.from)) return r.to + src.slice(r.from.length);

	return src;
}

interface Srcish {
	src?: unknown;
	[key: string]: unknown;
}

const fix = <T extends Srcish>(o: T | undefined | null, rules: readonly RewriteRule[]): T | undefined | null =>
	o && typeof o.src === "string" ? { ...o, src: rewriteUrl(o.src, rules) } : o;

/**
 * Same spec with every media src rewritten: layers (`footage`, `generative_video`,
 * `app_screen_recording` — any layer with a string `src`), `audio.voiceover`, `audio.music` and
 * each `audio.sfx[]`. Returns a new object; the input is not mutated. No rules = same object.
 */
export function rewriteSpecUrls<S extends { scenes: { layers: unknown[] }[]; audio?: unknown }>(
	spec: S,
	rules: readonly RewriteRule[],
): S {
	if (rules.length === 0) return spec;

	const audio = spec.audio as { voiceover?: Srcish; music?: Srcish; sfx?: Srcish[] } | undefined;

	return {
		...spec,
		scenes: spec.scenes.map((scene) => ({
			...scene,
			layers: scene.layers.map((l) => (l && typeof l === "object" ? fix(l as Srcish, rules) : l)),
		})),
		...(audio
			? {
					audio: {
						...audio,
						...(audio.voiceover ? { voiceover: fix(audio.voiceover, rules) } : {}),
						...(audio.music ? { music: fix(audio.music, rules) } : {}),
						...(Array.isArray(audio.sfx) ? { sfx: audio.sfx.map((x) => fix(x, rules)) } : {}),
					},
				}
			: {}),
	};
}
