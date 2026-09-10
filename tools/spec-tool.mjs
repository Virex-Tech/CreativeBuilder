#!/usr/bin/env node
/**
 * Operations on a CreativeSpec: wrap for rendering, derive variations, validate, diff.
 *
 * These exist as a script rather than as instructions in the skill because they are exact
 * mechanical operations — timing reflow, lineage bookkeeping, hash. Left to prose, they get
 * done slightly differently every time and the lineage stops being trustworthy.
 *
 * Usage:
 *   node tools/spec-tool.mjs props   <spec.json> [--out file]
 *   node tools/spec-tool.mjs validate <spec.json>
 *   node tools/spec-tool.mjs variant <spec.json> --mutation hook_rewrite --patch patch.json [--id cr_x]
 *   node tools/spec-tool.mjs diff    <a.json> <b.json>
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const readJson = async (p) => JSON.parse(await readFile(resolve(p), "utf8"));

async function writeJson(p, data) {
	await mkdir(dirname(resolve(p)), { recursive: true });
	await writeFile(resolve(p), JSON.stringify(data, null, "\t") + "\n");
}

const specHash = (spec) =>
	createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);

/**
 * Remotion's --props takes the props object, not the spec. Getting this wrong renders the
 * DEFAULT spec and reports success — a silent wrong answer, which is why it is a command.
 */
async function cmdProps(specPath, outArg) {
	const spec = await readJson(specPath);
	const out = outArg ?? join(dirname(specPath), "props", basename(specPath));
	await writeJson(out, { spec });
	console.log(out);
}

function validate(spec) {
	const errors = [];
	if (spec.specVersion !== "1") errors.push("specVersion deve ser \"1\"");
	if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) errors.push("scenes vazio");

	let cursor = 0;
	for (const [i, s] of (spec.scenes ?? []).entries()) {
		if (!s.id) errors.push(`cena ${i}: sem id`);
		if (!(s.durationMs > 0)) errors.push(`cena ${s.id ?? i}: durationMs inválido`);
		// Gaps and overlaps both render as bugs (black frames / stacked scenes), and both
		// are invisible until someone watches the whole video.
		if (s.startMs !== cursor) {
			errors.push(
				`cena ${s.id ?? i}: startMs ${s.startMs} não encaixa (esperado ${cursor})`,
			);
		}
		cursor = s.startMs + s.durationMs;
		for (const l of s.layers ?? []) {
			if (l.type === "text" && !l.content?.trim()) {
				errors.push(`cena ${s.id}: layer de texto vazia`);
			}
		}
	}

	const hookMs = spec.scenes?.[0]?.durationMs ?? 0;
	const warnings = [];
	if (hookMs > 3000) warnings.push(`hook de ${hookMs}ms — acima de 3s o público já saiu`);
	if (cursor > 60000) warnings.push(`${(cursor / 1000).toFixed(1)}s — longo para feed`);

	return { errors, warnings, durationMs: cursor };
}

async function cmdValidate(specPath) {
	const spec = await readJson(specPath);
	const r = validate(spec);
	console.log(JSON.stringify({ ...r, specHash: specHash(spec) }, null, 2));
	if (r.errors.length) process.exit(1);
}

/** Deep merge. Arrays are replaced wholesale — except `scenes`, see mergeScenes. */
function merge(base, patch) {
	if (Array.isArray(patch) || patch === null || typeof patch !== "object") return patch;
	const out = { ...base };
	for (const [k, v] of Object.entries(patch)) {
		if (k === "scenes" && Array.isArray(v) && Array.isArray(base.scenes)) {
			out.scenes = mergeScenes(base.scenes, v);
		} else if (k in base && typeof base[k] === "object" && !Array.isArray(base[k])) {
			out[k] = merge(base[k], v);
		} else {
			out[k] = v;
		}
	}

	return out;
}

/**
 * Scenes are matched by `id`, not by position.
 *
 * This is what makes a single-dimension mutation possible: a `hook_rewrite` patch carries
 * only the hook scene, and every other scene survives untouched. Replacing the array
 * wholesale — the naive merge — would silently delete the rest of the video, and the
 * variation would no longer isolate one changed dimension, which is the entire point.
 *
 * A scene id absent from the parent is appended, so a patch can also add a scene.
 */
function mergeScenes(baseScenes, patchScenes) {
	const byId = new Map(baseScenes.map((s) => [s.id, s]));
	for (const p of patchScenes) {
		byId.set(p.id, byId.has(p.id) ? { ...byId.get(p.id), ...p } : p);
	}

	// Preserve the parent's order; appended scenes go last.
	const order = [...baseScenes.map((s) => s.id)];
	for (const p of patchScenes) if (!order.includes(p.id)) order.push(p.id);

	return order.map((id) => byId.get(id));
}

/** Re-lays scene start times so a duration change never leaves a gap or an overlap. */
function reflow(spec) {
	let cursor = 0;
	for (const s of spec.scenes) {
		s.startMs = cursor;
		cursor += s.durationMs;
	}

	return spec;
}

async function cmdVariant(specPath, opts) {
	const parent = await readJson(specPath);
	const patch = opts.patch ? await readJson(opts.patch) : {};

	const child = reflow(merge(parent, patch));
	child.creativeId = opts.id ?? `${parent.creativeId}__${opts.mutation}`;
	// Lineage is what lets metrics attribute a win to ONE changed dimension later.
	child.lineage = { parentId: parent.creativeId, mutation: opts.mutation };

	const out = opts.out ?? join(dirname(specPath), `${child.creativeId}.json`);
	await writeJson(out, child);

	const r = validate(child);
	console.log(JSON.stringify({ out, mutation: opts.mutation, ...r }, null, 2));
}

async function cmdDiff(aPath, bPath) {
	const [a, b] = await Promise.all([readJson(aPath), readJson(bPath)]);
	const changes = [];

	// Recurse into arrays too, keyed by scene id where available. Dumping a whole changed
	// array would bury the one field that actually moved — and this diff exists precisely
	// so a human can approve the change before paying for a render.
	const label = (item, i) => (item && typeof item === "object" && item.id ? item.id : i);

	const walk = (x, y, path) => {
		if (Array.isArray(x) && Array.isArray(y)) {
			const len = Math.max(x.length, y.length);
			for (let i = 0; i < len; i++) {
				walk(x[i], y[i], `${path}[${label(x[i] ?? y[i], i)}]`);
			}

			return;
		}

		if (x && y && typeof x === "object" && typeof y === "object") {
			for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
				walk(x[k], y[k], path ? `${path}.${k}` : k);
			}

			return;
		}

		if (JSON.stringify(x) !== JSON.stringify(y)) changes.push({ path, from: x, to: y });
	};
	walk(a, b, "");

	console.log(JSON.stringify({ changes }, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
	const i = rest.indexOf(`--${name}`);

	return i === -1 ? undefined : rest[i + 1];
};

const commands = {
	props: () => cmdProps(rest[0], flag("out")),
	validate: () => cmdValidate(rest[0]),
	variant: () =>
		cmdVariant(rest[0], {
			mutation: flag("mutation") ?? "manual",
			patch: flag("patch"),
			id: flag("id"),
			out: flag("out"),
		}),
	diff: () => cmdDiff(rest[0], rest[1]),
};

if (!commands[cmd]) {
	console.error("comandos: props | validate | variant | diff");
	process.exit(1);
}

commands[cmd]().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
