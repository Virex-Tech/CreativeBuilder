/**
 * Output formats and the layout scale derived from them.
 *
 * Every px value in the presets and layers was tuned on a 1080×1920 (9:16) canvas. Instead of a
 * second set of numbers per format, the renderer scales them from the composition size:
 *
 * - **sizes** (font, padding, radius, shadow) scale by `s = min(w / 1080, h / 1350)` — full size
 *   down to 4:5, smaller only when the frame gets shorter than that (1:1), so a 3-line hook and a
 *   2-line caption still fit in a square without colliding;
 * - **vertical offsets** are "safe margin + stack": the platform safe margin (bottom 420px — the
 *   Reels/TikTok caption/buttons band — and top 230px — the header) scales with the height
 *   (`v = h / 1920`), and what is stacked beyond it (the hook 160px above the caption band, the
 *   CTA 220px above it, the badge/title below the header) scales like a size. So bands keep
 *   their relative place AND the text stacked between them never collides when fonts shrink
 *   slower than the frame (`L.bottom(px)` / `L.top(px)`);
 * - **horizontal gutters** scale by `w / 1080`.
 *
 * At 1080×1920 all three are exactly 1 — a 9:16 render is pixel-identical to the pre-scaling one.
 */

export const FORMAT_SIZES = {
	/** 9:16 — Reels, TikTok, Stories, Shorts. */
	VERTICAL: { w: 1080, h: 1920 },
	/** 4:5 — feed. */
	PORTRAIT: { w: 1080, h: 1350 },
	/** 1:1 — feed / carousel. */
	SQUARE: { w: 1080, h: 1080 },
} as const;

export type FormatName = keyof typeof FORMAT_SIZES;

export const FORMAT_NAMES = Object.keys(FORMAT_SIZES) as FormatName[];

export function isFormatName(value: unknown): value is FormatName {
	return typeof value === "string" && value in FORMAT_SIZES;
}

/**
 * Same spec in another format: only `format.w`/`format.h` change (fps and everything else is
 * kept). Returns a new object; the input is not mutated. The layout adapts on its own (see top).
 */
export function withFormat<T extends { format: { w: number; h: number } }>(spec: T, name: FormatName): T {
	const size = FORMAT_SIZES[name];
	if (!size) throw new Error(`formato desconhecido: ${String(name)} (use ${FORMAT_NAMES.join(" | ")})`);

	return { ...spec, format: { ...spec.format, w: size.w, h: size.h } };
}

/** The named format of a size, or null for a custom size. */
export function formatOf(w: number, h: number): FormatName | null {
	return FORMAT_NAMES.find((n) => FORMAT_SIZES[n].w === w && FORMAT_SIZES[n].h === h) ?? null;
}

/** The canvas every px constant was designed on. */
export const BASE_W = 1080;
export const BASE_H = 1920;
/** Below this height-per-1080-width (4:5), sizes start shrinking. */
const FULL_SIZE_MIN_H = 1350;
/** Platform safe margins on the base canvas (see top). */
export const SAFE_BOTTOM = 420;
export const SAFE_TOP = 230;

export interface Layout {
	w: number;
	h: number;
	/** Size scale (fonts, paddings, radii, shadows). */
	s: number;
	/** Scales a size in base px. */
	size: (px: number) => number;
	/** Scales a pure proportional vertical distance in base px. */
	y: (px: number) => number;
	/** Distance from the BOTTOM edge (base px): safe margin scales with height, the rest as a size. */
	bottom: (px: number) => number;
	/** Distance from the TOP edge (base px): safe margin scales with height, the rest as a size. */
	top: (px: number) => number;
	/** Scales a horizontal gutter in base px. */
	x: (px: number) => number;
}

export function layoutFor(w: number, h: number): Layout {
	const s = Math.min(w / BASE_W, h / FULL_SIZE_MIN_H);
	const v = h / BASE_H;
	const hx = w / BASE_W;

	return {
		w,
		h,
		s,
		// Multiplying by exactly 1 keeps 9:16 values bit-identical to the old constants.
		size: (px) => px * s,
		y: (px) => px * v,
		bottom: (px) => SAFE_BOTTOM * v + (px - SAFE_BOTTOM) * s,
		top: (px) => SAFE_TOP * v + (px - SAFE_TOP) * s,
		x: (px) => px * hx,
	};
}

/** Layout of the canvas the constants were tuned on (scale 1). */
export const BASE_LAYOUT: Layout = layoutFor(BASE_W, BASE_H);
