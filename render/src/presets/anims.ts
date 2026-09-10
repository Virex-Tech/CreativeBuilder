import { interpolate, spring } from "remotion";

import type { BrandKit, Layer, TextPreset } from "../spec";

export interface AnimState {
	opacity: number;
	scale: number;
	translateY: number;
}

const IDLE: AnimState = { opacity: 1, scale: 1, translateY: 0 };

/**
 * Named animations, resolved from the spec's `anim` field.
 *
 * Keeping these behind names (instead of raw easing curves in the spec) is deliberate: the
 * AI picks from a vocabulary the brand already approved, and changing how "pop_in" feels
 * updates every creative at once instead of requiring a rewrite of a thousand specs.
 */
export function resolveAnim(
	anim: Layer["anim"],
	frame: number,
	fps: number,
	durationInFrames: number,
): AnimState {
	switch (anim) {
		case "pop_in": {
			const s = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });

			return { opacity: Math.min(1, s * 1.4), scale: 0.86 + s * 0.14, translateY: 0 };
		}
		case "fade_in":
			return {
				...IDLE,
				opacity: interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
			};
		case "slide_up": {
			const s = spring({ frame, fps, config: { damping: 18 } });

			return { opacity: Math.min(1, s * 1.6), scale: 1, translateY: (1 - s) * 60 };
		}
		case "punch_in":
			// Slow push in across the whole layer — keeps a static screenshot alive.
			return {
				...IDLE,
				scale: interpolate(frame, [0, durationInFrames], [1, 1.08], {
					extrapolateRight: "clamp",
				}),
			};
		case "tilt_scroll":
			return {
				...IDLE,
				translateY: interpolate(frame, [0, durationInFrames], [0, -80], {
					extrapolateRight: "clamp",
				}),
			};
		case "handheld_subtle": {
			// Tiny irregular drift, so generated b-roll does not feel locked to a tripod.
			const t = frame / fps;

			return {
				opacity: 1,
				scale: 1.04,
				translateY: Math.sin(t * 2.1) * 4 + Math.sin(t * 5.3) * 1.5,
			};
		}
		case "none":
		default:
			return IDLE;
	}
}

export interface TextStyle {
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	color: string;
	textShadow?: string;
	maxWidth: string;
	textAlign: "center" | "left";
	bottom?: number;
	top?: number;
}

/**
 * Text presets carry the safe-area and legibility rules, not just looks. Sound-off is the
 * feed default, so text has to survive on its own.
 */
export function resolveTextPreset(preset: TextPreset, brand: BrandKit): TextStyle {
	switch (preset) {
		case "hook_stroke":
			return {
				fontSize: 96,
				fontWeight: 800,
				lineHeight: 1.05,
				color: brand.fg,
				textShadow: "0 6px 28px rgba(0,0,0,0.65)",
				maxWidth: "86%",
				textAlign: "center",
			};
		case "cta_label":
			return {
				fontSize: 68,
				fontWeight: 800,
				lineHeight: 1.1,
				color: brand.fg,
				maxWidth: "84%",
				textAlign: "center",
			};
		case "caption":
			return {
				fontSize: 54,
				fontWeight: 700,
				lineHeight: 1.2,
				color: brand.fg,
				textShadow: "0 4px 18px rgba(0,0,0,0.7)",
				maxWidth: "80%",
				textAlign: "center",
				bottom: 260,
			};
		case "sub":
		default:
			return {
				fontSize: 62,
				fontWeight: 700,
				lineHeight: 1.15,
				color: brand.fg,
				textShadow: "0 4px 18px rgba(0,0,0,0.55)",
				maxWidth: "82%",
				textAlign: "center",
			};
	}
}
