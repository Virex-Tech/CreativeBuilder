import type { Layer } from "../spec";

/** Time a layer occupies inside its scene, in ms. */
function layerSpan(layer: Layer, sceneMs: number): [number, number] {
	const start = layer.startMs ?? 0;

	return [start, layer.durationMs ? start + layer.durationMs : sceneMs];
}

/**
 * A `title_top` that is on screen at the same time as a `badge` of its scene stacks below the
 * badge (both live in the top band). For its whole duration — a title that jumps mid-read when the
 * badge pops in reads as a glitch.
 */
export function titleUnderBadge(layer: Layer, badges: Layer[], sceneMs: number): { badgeWithLabel: boolean } | undefined {
	if (layer.type !== "text" || layer.preset !== "title_top" || badges.length === 0) return undefined;
	const [a0, a1] = layerSpan(layer, sceneMs);
	const overlapping = badges.filter((b) => {
		const [b0, b1] = layerSpan(b, sceneMs);

		return a0 < b1 && b0 < a1;
	});
	if (overlapping.length === 0) return undefined;

	return { badgeWithLabel: overlapping.some((b) => b.type === "badge" && !!b.label) };
}
