import { z } from "zod";

/**
 * CreativeSpec — the single source of truth for a creative.
 *
 * The AI never "edits video": it writes and rewrites this JSON, and the renderer is a pure
 * function of it. That is what makes a variation a diff, a duplicate a clone+patch, and an
 * adjustment a single field change.
 *
 * This schema is the contract between the API, the agents and this renderer. Keep it
 * versioned (`specVersion`) — a spec stored today must still render a year from now.
 */

export const sceneRole = z.enum(["HOOK", "PROBLEM", "DEMO", "PROOF", "CTA", "POINT"]);

/** Named animation presets. The spec references behaviour by name, never by raw easing. */
export const animPreset = z.enum([
	"none",
	"pop_in",
	"fade_in",
	"slide_up",
	"punch_in",
	"tilt_scroll",
	"handheld_subtle",
]);

export const textPreset = z.enum(["hook_stroke", "sub", "caption", "cta_label"]);

/**
 * Entrance effect for a scene's first frames. Never changes total duration or `startMs` —
 * it is purely how the first `transitionMs` of the entering scene render.
 */
export const transitionKind = z.enum(["cut", "fade", "zoom", "whip", "slide_up", "flash"]);

const baseLayer = z.object({
	/** Offset inside the scene; defaults to the scene start. */
	startMs: z.number().int().min(0).optional(),
	durationMs: z.number().int().positive().optional(),
	anim: animPreset.default("none"),
});

export const textLayer = baseLayer.extend({
	type: z.literal("text"),
	content: z.string().min(1),
	preset: textPreset.default("sub"),
});

/** Generated b-roll (Higgsfield / fal). `assetId` is filled once the asset exists. */
export const generativeVideoLayer = baseLayer.extend({
	type: z.literal("generative_video"),
	prompt: z.string().min(1),
	provider: z.enum(["higgsfield", "fal"]).default("fal"),
	assetId: z.string().optional(),
	src: z.string().optional(),
	fit: z.enum(["cover", "contain"]).default("cover"),
	/** Skip this much of the source clip — use a long attached video without pre-cutting it. */
	startFromMs: z.number().int().min(0).default(0),
});

/** App screen recording, composited inside a device frame. */
export const appScreenLayer = baseLayer.extend({
	type: z.literal("app_screen_recording"),
	assetId: z.string().optional(),
	src: z.string().optional(),
	device: z.enum(["iphone15_mock", "none"]).default("iphone15_mock"),
	/** Skip this much of the recording. Ignored for images. */
	startFromMs: z.number().int().min(0).default(0),
});

export const solidLayer = baseLayer.extend({
	type: z.literal("solid"),
	color: z.string().default("#0B0B0F"),
});

/**
 * Persistent rounded badge at the top (the reference's "SEMANA 1" chip).
 * A structural element of the format, so it is a layer type rather than free-form text —
 * the AI cannot accidentally restyle it per scene.
 */
export const badgeLayer = baseLayer.extend({
	type: z.literal("badge"),
	label: z.string().default(""),
	value: z.string().min(1),
});

/**
 * Karaoke captions: the active word is highlighted in the accent colour.
 *
 * Word timings come from voiceover alignment when a VO exists. Without one, the words are
 * distributed evenly across the layer — an approximation that reads correctly but should
 * be replaced by real alignment before anything is published.
 */
export const karaokeLayer = baseLayer.extend({
	type: z.literal("karaoke"),
	text: z.string().min(1),
	/** Per-word end times in ms, relative to the layer. Optional; even split when absent. */
	wordEndsMs: z.array(z.number().int().positive()).optional(),
});

/** Small legal line pinned to the bottom ("Dramatização..."). Required in health/fitness ads. */
export const disclaimerLayer = baseLayer.extend({
	type: z.literal("disclaimer"),
	text: z.string().min(1),
});

export const layer = z.discriminatedUnion("type", [
	textLayer,
	generativeVideoLayer,
	appScreenLayer,
	solidLayer,
	badgeLayer,
	karaokeLayer,
	disclaimerLayer,
]);

export const scene = z.object({
	id: z.string().min(1),
	role: sceneRole,
	startMs: z.number().int().min(0),
	durationMs: z.number().int().positive(),
	/**
	 * "locked" scenes must keep their duration (they sync to a cut or a UI animation);
	 * "flex" scenes absorb timing differences — which is how a locale swap survives a
	 * voiceover that runs 20% longer in PT than in EN.
	 */
	timing: z.enum(["locked", "flex"]).default("flex"),
	/** How this scene enters. The first scene always ignores it (nothing to transition from). */
	transitionIn: transitionKind.default("cut"),
	/** Length of the entrance effect in ms — bounded so it can never eat a whole short scene. */
	transitionMs: z.number().int().min(80).max(600).default(250),
	layers: z.array(layer).min(1),
});

const BRAND_DEFAULTS = {
	bg: "#0B0B0F",
	fg: "#FFFFFF",
	accent: "#6C5CE7",
	fontFamily: "Inter, system-ui, sans-serif",
};

/**
 * Audio track. `src` is either an absolute URL or a path inside `public/`.
 *
 * Ducking is expressed in dB below the music's own gain, applied only while the voiceover
 * is speaking — a fixed low music volume either buries the track or fights the voice, and
 * getting this wrong is the fastest way to make an ad feel amateur.
 */
export const audioTrack = z.object({
	src: z.string().min(1),
	/** 0..1 linear gain. */
	volume: z.number().min(0).max(1).default(1),
	/** Skip this much of the source file before playing. */
	startFromMs: z.number().int().min(0).default(0),
});

export const specAudio = z.object({
	voiceover: audioTrack
		.extend({
			/** The script, kept for regeneration and for caption alignment. */
			script: z.string().optional(),
			voiceId: z.string().optional(),
			provider: z.enum(["higgsfield", "elevenlabs"]).optional(),
			/** When the voiceover starts on the timeline. */
			atMs: z.number().int().min(0).default(0),
			/**
			 * How long it lasts. Drives when the music comes back up — without it the music
			 * would stay ducked to the end of the video, long after the voice stopped.
			 */
			durationMs: z.number().int().positive().optional(),
		})
		.optional(),
	music: audioTrack
		.extend({
			/** dB to drop the music while the voiceover plays. Negative. */
			duckingDb: z.number().max(0).default(-14),
		})
		.optional(),
	/** One-shot effects (cut whooshes, UI pops) placed at absolute timeline positions. */
	sfx: z
		.array(
			z.object({
				src: z.string().min(1),
				atMs: z.number().int().min(0),
				volume: z.number().min(0).max(1).default(0.6),
			}),
		)
		.optional(),
});

export const brandKit = z.object({
	bg: z.string().default(BRAND_DEFAULTS.bg),
	fg: z.string().default(BRAND_DEFAULTS.fg),
	accent: z.string().default(BRAND_DEFAULTS.accent),
	fontFamily: z.string().default(BRAND_DEFAULTS.fontFamily),
});

export const creativeSpec = z.object({
	specVersion: z.literal("1"),
	creativeId: z.string().min(1),
	appId: z.string().min(1),
	locale: z.string().default("pt-BR"),
	lineage: z
		.object({ parentId: z.string().optional(), mutation: z.string().optional() })
		.optional(),
	output: z.object({ kind: z.enum(["video", "image", "carousel"]).default("video") }).default({
		kind: "video",
	}),
	format: z.object({
		w: z.number().int().positive().default(1080),
		h: z.number().int().positive().default(1920),
		fps: z.number().int().positive().default(30),
	}),
	brandKit: brandKit.default(BRAND_DEFAULTS),
	audio: specAudio.optional(),
	scenes: z.array(scene).min(1),
});

export type CreativeSpec = z.infer<typeof creativeSpec>;
export type Scene = z.infer<typeof scene>;
export type Layer = z.infer<typeof layer>;
export type BrandKit = z.infer<typeof brandKit>;
export type TextPreset = z.infer<typeof textPreset>;
export type SpecAudio = z.infer<typeof specAudio>;
export type TransitionKind = z.infer<typeof transitionKind>;

/** dB attenuation as a linear multiplier, for mixing. */
export function dbToGain(db: number): number {
	return Math.pow(10, db / 20);
}

/** Total duration derived from the scenes — the spec never states it twice. */
export function specDurationMs(spec: CreativeSpec): number {
	return spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
}

export function msToFrames(ms: number, fps: number): number {
	return Math.max(1, Math.round((ms / 1000) * fps));
}
