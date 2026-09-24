import { Easing, interpolate, spring } from "remotion";

import { msToFrames, type BrandKit, type Layer, type TextPreset, type TransitionKind } from "../spec";

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

export interface TransitionState {
	opacity: number;
	transform: string;
	filter: string;
	/** Extra white overlay on top of everything, for the "flash" cut. 0 = no overlay. */
	flashOpacity: number;
}

const TRANSITION_IDLE: TransitionState = {
	opacity: 1,
	transform: "none",
	filter: "none",
	flashOpacity: 0,
};

/**
 * Entrance effect for a whole scene, driven purely by frames elapsed since the scene's own
 * `Sequence` started — it never touches `startMs` or duration, only how the first
 * `transitionMs` render. Values are clamped so the scene settles at its normal look right on
 * schedule and stays there for the rest of its run.
 */
export function resolveTransition(
	kind: TransitionKind,
	frame: number,
	fps: number,
	transitionMs: number,
): TransitionState {
	const durFrames = Math.max(1, msToFrames(transitionMs, fps));
	const t = Math.min(1, Math.max(0, frame / durFrames));

	switch (kind) {
		case "fade":
			return { ...TRANSITION_IDLE, opacity: t };
		case "zoom": {
			const eased = Easing.out(Easing.cubic)(t);

			return {
				...TRANSITION_IDLE,
				transform: `scale(${(1.15 - eased * 0.15).toFixed(4)})`,
				filter: `blur(${((1 - eased) * 6).toFixed(2)}px)`,
			};
		}
		case "whip": {
			const eased = Easing.out(Easing.cubic)(t);

			// The previous scene is already gone, so a full-width slide would expose an empty frame.
			// Keep the offset inside what the overscale covers (|dx| <= (scale - 1) / 2): the eye
			// reads the heavy blur as a whip pan, and no black edge ever shows.
			const scale = 1.3 - eased * 0.3;
			const dx = -15 * (1 - eased);

			return {
				...TRANSITION_IDLE,
				transform: `scale(${scale.toFixed(4)}) translateX(${dx.toFixed(2)}%)`,
				filter: `blur(${((1 - eased) * 28).toFixed(2)}px)`,
			};
		}
		case "slide_up": {
			const eased = Easing.out(Easing.cubic)(t);

			// Same overscale rule as "whip": rise from slightly below without revealing the background.
			const scale = 1.3 - eased * 0.3;
			const dy = 15 * (1 - eased);

			return {
				...TRANSITION_IDLE,
				transform: `scale(${scale.toFixed(4)}) translateY(${dy.toFixed(2)}%)`,
				filter: `blur(${((1 - eased) * 10).toFixed(2)}px)`,
			};
		}
		case "flash":
			// Content stays put; a white overlay flashes and burns off over the transition.
			return { ...TRANSITION_IDLE, flashOpacity: (1 - t) * 0.8 };
		case "cut":
		default:
			return TRANSITION_IDLE;
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
	/** Pill behind the text — for calls to action that must read as a button, not a caption. */
	background?: string;
	padding?: string;
	borderRadius?: number;
	boxShadow?: string;
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
				// Bottom-anchored so the block's vertical center lands near y≈1180 (lower-middle
				// third), not the screen's geometric middle — keeps it clear of the header safe
				// area above and the caption band below.
				bottom: 580,
			};
		case "cta_label":
			// A CTA reads as a tappable pill in the brand colour, sitting above the caption band —
			// loose white text over a face looks like a subtitle, not an offer.
			return {
				fontSize: 60,
				fontWeight: 800,
				lineHeight: 1.1,
				color: brand.fg,
				maxWidth: "84%",
				textAlign: "center",
				bottom: 640,
				background: brand.accent,
				padding: "22px 48px",
				borderRadius: 999,
				boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
			};
		case "title_top":
			// Título fixo no topo, no estilo do texto nativo do Reels/TikTok (caixa clara, letra
			// escura): o hook escrito de conteúdo UGC. Abaixo da faixa do cabeçalho da plataforma.
			return {
				fontSize: 58,
				fontWeight: 800,
				lineHeight: 1.15,
				color: "#0B0B0F",
				maxWidth: "84%",
				textAlign: "center",
				top: 250,
				background: "#FFFFFF",
				padding: "16px 30px",
				borderRadius: 18,
				boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
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
				// Base of the block ~420px from the bottom (y≈1500), just above the platform's
				// caption/description/button safe area.
				bottom: 420,
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
				// Same low caption band as `caption` — this is a legend/sub preset too.
				bottom: 420,
			};
	}
}
