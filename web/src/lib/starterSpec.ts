import type { CreativeSpec } from "@render/spec";

/**
 * A minimal, valid CreativeSpec used to seed a brand-new creative so the editor opens on
 * something that already renders (hook + CTA), instead of a blank JSON the user has to
 * author from memory. Everything here is meant to be replaced in the editor.
 *
 * `creativeId` only has to be unique and stable within the spec — the server owns the real
 * id. A timestamp-based token is enough and keeps two quick creations from colliding.
 */
export function starterSpec(appId: string, locale: string): CreativeSpec {
	return {
		specVersion: "1",
		creativeId: `cr_${Date.now().toString(36)}`,
		appId,
		locale,
		output: { kind: "video" },
		format: { w: 1080, h: 1920, fps: 30 },
		brandKit: {
			bg: "#0B0B0F",
			fg: "#FFFFFF",
			accent: "#7C5CFF",
			fontFamily: "Inter, system-ui, sans-serif",
		},
		scenes: [
			{
				id: "hook",
				role: "HOOK",
				startMs: 0,
				durationMs: 2500,
				timing: "flex",
				transitionIn: "cut",
				transitionMs: 250,
				layers: [{ type: "text", content: "Seu gancho aqui", preset: "hook_stroke", anim: "pop_in" }],
			},
			{
				id: "cta",
				role: "CTA",
				startMs: 2500,
				durationMs: 3000,
				timing: "flex",
				transitionIn: "fade",
				transitionMs: 250,
				layers: [{ type: "text", content: "Baixe o app", preset: "cta_label", anim: "fade_in" }],
			},
		],
	};
}
