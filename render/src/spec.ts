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

export const textPreset = z.enum(["hook_stroke", "sub", "caption", "cta_label", "title_top"]);

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

/** Generated b-roll (Kie / Higgsfield / fal). `assetId` is the provider task id once the asset exists. */
export const generativeVideoLayer = baseLayer.extend({
	type: z.literal("generative_video"),
	prompt: z.string().min(1),
	provider: z.enum(["kie", "higgsfield", "fal"]).default("kie"),
	assetId: z.string().optional(),
	src: z.string().optional(),
	fit: z.enum(["cover", "contain"]).default("cover"),
	/** Skip this much of the source clip — use a long attached video without pre-cutting it. */
	startFromMs: z.number().int().min(0).default(0),
});

/**
 * Footage filmed by a person (a "take"): the creator's own video, with its own sound.
 *
 * This is the UGC edit's raw material — the opposite of `generative_video`. Its audio plays by
 * default because the speech IS the content; a take is trimmed with `startFromMs` and the
 * layer/scene duration, never re-encoded per edit. `takeId` ties it to the transcript the
 * server uses to rebuild the captions after every edit.
 */
export const footageLayer = baseLayer.extend({
	type: z.literal("footage"),
	takeId: z.string().optional(),
	src: z.string().min(1),
	/** In-point inside the take. The out-point is the layer (or scene) duration. */
	startFromMs: z.number().int().min(0).default(0),
	fit: z.enum(["cover", "contain"]).default("cover"),
	/** 0..1 gain of the take's own sound. 0 mutes it (b-roll use of a take). */
	volume: z.number().min(0).max(1).default(1),
	/**
	 * Static punch-in (1 = none). A jump cut between two clips of the same take reads as a
	 * glitch at the same framing and as intentional at 1.1–1.2 — the standard UGC trick.
	 */
	zoom: z.number().min(1).max(1.6).default(1),
	/** Mirror horizontally (front-camera takes are often flipped). */
	mirror: z.boolean().default(false),
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
	/**
	 * Written by the server from a take's transcript (not by a person or the model). Auto
	 * captions are thrown away and rebuilt after every edit, so they always match the cut.
	 */
	auto: z.boolean().optional(),
});

/** Small legal line pinned to the bottom ("Dramatização..."). Required in health/fitness ads. */
export const disclaimerLayer = baseLayer.extend({
	type: z.literal("disclaimer"),
	text: z.string().min(1),
});

export const layer = z.discriminatedUnion("type", [
	textLayer,
	generativeVideoLayer,
	footageLayer,
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
			provider: z.enum(["kie", "higgsfield", "elevenlabs"]).optional(),
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
	/**
	 * Captions from the takes' real speech: the server splits each footage clip's words into
	 * short blocks (auto karaoke layers) with exact word timings. Off = no auto captions.
	 */
	autoCaptions: z
		.object({
			enabled: z.boolean().default(true),
			/** Words per caption block. 3–4 reads at a glance; more becomes a paragraph. */
			maxWords: z.number().int().min(1).max(8).default(4),
		})
		.optional(),
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

/**
 * Where something STARTS on the timeline. Unlike a duration it can be 0 — `msToFrames` clamps
 * to 1, which pushed every opening scene to frame 1 and left frame 0 as an empty background
 * (a black first frame, which Instagram uses as the default Reels cover).
 */
export function msToStartFrame(ms: number, fps: number): number {
	return Math.max(0, Math.round((ms / 1000) * fps));
}
