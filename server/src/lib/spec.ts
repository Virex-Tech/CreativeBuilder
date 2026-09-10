import { createHash } from "node:crypto";

/**
 * Spec helpers shared by the routes.
 *
 * The zod schema itself lives in render (`src/spec.ts`) and is the contract of
 * record. This service validates shape enough to refuse nonsense, then lets the renderer be
 * the authority — duplicating the full schema here would guarantee the two drift apart.
 */

export function specHash(spec: unknown): string {
	return createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);
}

export interface SpecScene {
	id: string;
	role: string;
	startMs: number;
	durationMs: number;
	timing?: "locked" | "flex";
	layers: unknown[];
}

export interface Spec {
	specVersion: string;
	creativeId?: string;
	appId?: string;
	locale?: string;
	scenes: SpecScene[];
	[key: string]: unknown;
}

export function isSpec(value: unknown): value is Spec {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;

	return v.specVersion === "1" && Array.isArray(v.scenes) && v.scenes.length > 0;
}

/** Total duration derived from the scenes, so it is never stored twice. */
export function specDurationMs(spec: Spec): number {
	return spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
}

/**
 * Re-lays scene start times after any duration change.
 *
 * Called on every write rather than trusting the client: a gap renders as a black frame and
 * an overlap stacks two scenes, and both are invisible until someone watches the whole
 * video. Cheap to enforce, expensive to discover late.
 */
export function reflow<T extends Spec>(spec: T): T {
	let cursor = 0;
	for (const scene of spec.scenes) {
		scene.startMs = cursor;
		cursor += scene.durationMs;
	}

	return spec;
}

/** Merges a patch into a spec. Scenes are matched by `id` so a single-dimension mutation
 * (a hook rewrite, say) leaves every other scene untouched. */
export function mergeSpec(base: Spec, patch: Record<string, unknown>): Spec {
	const out: Record<string, unknown> = { ...base };

	for (const [key, value] of Object.entries(patch)) {
		if (key === "scenes" && Array.isArray(value)) {
			out.scenes = mergeScenes(base.scenes, value as SpecScene[]);
		} else if (
			value !== null &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			typeof base[key] === "object" &&
			base[key] !== null &&
			!Array.isArray(base[key])
		) {
			out[key] = { ...(base[key] as object), ...(value as object) };
		} else {
			out[key] = value;
		}
	}

	return out as Spec;
}

function mergeScenes(baseScenes: SpecScene[], patchScenes: SpecScene[]): SpecScene[] {
	const byId = new Map(baseScenes.map((s) => [s.id, s]));
	for (const p of patchScenes) {
		const existing = byId.get(p.id);
		byId.set(p.id, existing ? { ...existing, ...p } : p);
	}

	const order = baseScenes.map((s) => s.id);
	for (const p of patchScenes) if (!order.includes(p.id)) order.push(p.id);

	return order.map((id) => byId.get(id)!);
}

export interface SpecIssues {
	errors: string[];
	warnings: string[];
	durationMs: number;
}

export function validateSpec(spec: Spec, director?: Record<string, unknown>): SpecIssues {
	const errors: string[] = [];
	const warnings: string[] = [];

	let cursor = 0;
	for (const [i, scene] of spec.scenes.entries()) {
		if (!scene.id) errors.push(`cena ${i}: sem id`);
		if (!(scene.durationMs > 0)) errors.push(`cena ${scene.id || i}: durationMs inválido`);
		if (!Array.isArray(scene.layers) || scene.layers.length === 0) {
			errors.push(`cena ${scene.id || i}: sem layers`);
		}
		cursor = scene.startMs + scene.durationMs;
	}

	// The DirectorProfile is the house rule and outranks brief and reference alike.
	const hookMax = (director?.pacing as { hook_max_ms?: number } | undefined)?.hook_max_ms;
	const hookMs = spec.scenes[0]?.durationMs ?? 0;
	if (hookMax && hookMs > hookMax) {
		warnings.push(`hook de ${hookMs}ms excede hook_max_ms (${hookMax}) do DirectorProfile`);
	}
	if (cursor > 60_000) warnings.push(`${(cursor / 1000).toFixed(1)}s — longo para feed`);

	return { errors, warnings, durationMs: cursor };
}
