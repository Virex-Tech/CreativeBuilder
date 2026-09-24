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
 *   node tools/spec-tool.mjs check   <spec.json>
 *   node tools/spec-tool.mjs variant <spec.json> --mutation hook_rewrite --patch patch.json [--id cr_x]
 *   node tools/spec-tool.mjs diff    <a.json> <b.json>
 *   node tools/spec-tool.mjs sync-captions <spec.json> --words <voz.words.json> [--fit-scenes] [--chunk 4]
 *   node tools/spec-tool.mjs footage <spec.json> [--out file]
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

const VISUAL_TYPES = new Set(["generative_video", "app_screen_recording", "footage"]);
const isVideoSrc = (src) => /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(src);

/** `render/public/<src>` for a local path, or null when `src` is already an absolute URL. */
function publicPath(specPath, src) {
	if (/^https?:\/\//i.test(src)) return null;
	// Assets are resolved relative to render/public regardless of where the spec lives.
	const renderRoot = specPath.includes("render") ? specPath.split(/render[\\/]/i)[0] + "render" : resolve("render");

	return join(renderRoot, "public", src);
}

/** ffprobe duration in ms, or null when the file can't be probed (missing/corrupt/not media). */
async function probeDurationMs(path) {
	try {
		const { stdout } = await execFileAsync("ffprobe", [
			"-v", "error",
			"-show_entries", "format=duration",
			"-of", "json",
			path,
		]);
		const data = JSON.parse(stdout);
		const sec = Number(data.format?.duration);

		return Number.isFinite(sec) ? sec * 1000 : null;
	} catch {
		return null;
	}
}

/**
 * Checks that need the filesystem and ffprobe, on top of the structural `validate`.
 *
 * This is what would have caught the real failure that prompted it: a scene with no visual
 * layer at all (just background + caption), a b-roll clip shorter than the scene it fills,
 * and captions with no word timing next to a voiceover that has real timing to offer.
 */
async function check(spec, specPath) {
	const errors = [];
	const warnings = [];

	const totalMs = specDurationMsOf(spec);
	let hasAnyCaption = false;

	for (const scene of spec.scenes ?? []) {
		let hasVisual = false;

		for (const layer of scene.layers ?? []) {
			if (layer.type === "karaoke" || layer.type === "text") hasAnyCaption = true;

			if (!VISUAL_TYPES.has(layer.type)) continue;
			hasVisual = true;

			if (!layer.src) {
				errors.push(
					`cena ${scene.id}: layer ${layer.type} sem src (vai renderizar placeholder)`,
				);
				continue;
			}

			const abs = publicPath(specPath, layer.src);
			if (abs && !existsSync(abs)) {
				errors.push(`cena ${scene.id}: src "${layer.src}" não existe em render/public/`);
				continue;
			}

			// Only videos can "run out" — an image just holds, so duration checks don't apply.
			const isVideo = layer.type === "generative_video" || layer.type === "footage" || isVideoSrc(layer.src);
			if (!isVideo || !abs) continue;

			const durationMs = await probeDurationMs(abs);
			if (durationMs === null) continue;

			const usefulMs = durationMs - (layer.startFromMs ?? 0);
			const onScreenMs = layer.durationMs ?? scene.durationMs - (layer.startMs ?? 0);
			if (usefulMs < onScreenMs) {
				warnings.push(
					`cena ${scene.id}: clipe acaba antes da cena (${(usefulMs / 1000).toFixed(1)}s de ${(onScreenMs / 1000).toFixed(1)}s) — gere mais longo, use outro trecho ou encurte a cena`,
				);
			}
		}

		if (!hasVisual) {
			errors.push(`cena ${scene.id}: sem vídeo/imagem: só fundo e texto`);
		}
	}

	// Caption/voice sync: no wordEndsMs means the renderer falls back to an even split, which
	// is exactly the "legenda não acompanha o áudio" bug this command exists to catch early.
	const vo = spec.audio?.voiceover;
	if (vo) {
		const hasUnsynced = (spec.scenes ?? []).some((s) =>
			(s.layers ?? []).some((l) => l.type === "karaoke" && !l.wordEndsMs?.length),
		);
		if (hasUnsynced) {
			warnings.push("legenda não sincronizada com a voz — rode transcribe + sync-captions");
		}

		if (vo.durationMs == null) {
			warnings.push("audio.voiceover sem durationMs — a música fica abafada até o fim do vídeo");
		} else if (vo.atMs + vo.durationMs > totalMs) {
			warnings.push(
				`audio.voiceover termina em ${((vo.atMs + vo.durationMs) / 1000).toFixed(1)}s, depois do fim do vídeo (${(totalMs / 1000).toFixed(1)}s)`,
			);
		}

		const voAbs = publicPath(specPath, vo.src);
		if (voAbs && !existsSync(voAbs)) {
			errors.push(`audio.voiceover.src "${vo.src}" não existe em render/public/`);
		}
	}

	const music = spec.audio?.music;
	if (music) {
		const musicAbs = publicPath(specPath, music.src);
		if (musicAbs && !existsSync(musicAbs)) {
			errors.push(`audio.music.src "${music.src}" não existe em render/public/`);
		}
	}

	// Take com fala sem as legendas automáticas = o `footage` não rodou depois da última mudança.
	const hasFootage = (spec.scenes ?? []).some((s) => (s.layers ?? []).some((l) => l.type === "footage"));
	const hasAuto = (spec.scenes ?? []).some((s) => (s.layers ?? []).some((l) => l.type === "karaoke" && l.auto));
	if (hasFootage && spec.autoCaptions?.enabled !== false && !hasAuto) {
		warnings.push("takes sem legenda da fala — rode: node tools/spec-tool.mjs footage <spec>");
	}

	if (!hasAnyCaption) {
		warnings.push("nenhuma legenda (karaoke/text) no vídeo inteiro — sem legenda com som desligado");
	}

	return { errors, warnings };
}

/** Same shape as spec.ts's specDurationMs, kept local so this script has no build step. */
function specDurationMsOf(spec) {
	return (spec.scenes ?? []).reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
}

async function cmdCheck(specPath) {
	const spec = await readJson(specPath);
	const structural = validate(spec);
	const extra = await check(spec, resolve(specPath));

	const errors = [...structural.errors, ...extra.errors];
	const warnings = [...structural.warnings, ...extra.warnings];
	const ok = errors.length === 0;

	console.log(JSON.stringify({ errors, warnings, ok }, null, 2));
	if (!ok) process.exit(1);
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

/** Lowercase, no accents, no punctuation — so "você," in a caption matches "Você" in the VO. */
const normWord = (w) =>
	w
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Fills `wordEndsMs` of every karaoke layer from a word-timed transcript of the voiceover
 * (tools/transcribe.py). Without it the renderer splits words evenly, which drifts from the
 * voice after two or three words.
 *
 * Words are matched in order with a small lookahead, so a caption that trims or paraphrases the
 * VO still locks on wherever the words agree; unmatched words are interpolated between matched
 * neighbours. Transcript times are relative to the audio file, hence the voiceover offset.
 */
async function cmdSyncCaptions(specPath, opts) {
	if (!opts.words) throw new Error("uso: sync-captions <spec.json> --words <voz.words.json> [--fit-scenes] [--out arquivo]");

	const spec = await readJson(specPath);
	const transcript = await readJson(opts.words);
	const vo = spec.audio?.voiceover ?? {};
	const offsetMs = (vo.atMs ?? 0) - (vo.startFromMs ?? 0);
	const spoken = transcript.words
		.map((w) => ({ key: normWord(w.word), startMs: w.startMs + offsetMs, endMs: w.endMs + offsetMs }))
		.filter((w) => w.key);

	// Match caption words to spoken words by text only, in order, with a small lookahead — so the
	// match does not depend on scene timing and can drive --fit-scenes.
	const LOOKAHEAD = 12;
	let cursor = 0;
	const karaoke = [];
	for (const scene of spec.scenes) {
		for (const layer of scene.layers) {
			if (layer.type !== "karaoke") continue;
			const tokens = layer.text.split(/\s+/).filter(Boolean);
			const matches = tokens.map((token) => {
				const key = normWord(token);
				for (let j = cursor; j < Math.min(spoken.length, cursor + LOOKAHEAD); j++) {
					if (spoken[j].key === key) {
						cursor = j + 1;

						return spoken[j];
					}
				}

				return null;
			});
			karaoke.push({ scene, layer, tokens, matches });
		}
	}

	if (opts.fitScenes) {
		// Cut on the voice: each spoken scene ends halfway between its last word and the next
		// scene's first word, so the edit breathes with the VO instead of cutting mid-sentence.
		const MIN_SCENE_MS = 700;
		const TAIL_MS = 450;
		const spanOf = (scene) => {
			const words = karaoke.filter((k) => k.scene === scene).flatMap((k) => k.matches.filter(Boolean));

			return words.length ? { first: words[0].startMs, last: words[words.length - 1].endMs } : null;
		};
		let t = spec.scenes[0].startMs;
		spec.scenes.forEach((scene, i) => {
			scene.startMs = t;
			const span = spanOf(scene);
			if (span) {
				const nextSpan = spec.scenes[i + 1] ? spanOf(spec.scenes[i + 1]) : null;
				const end = nextSpan ? (span.last + nextSpan.first) / 2 : span.last + TAIL_MS;
				scene.durationMs = Math.max(MIN_SCENE_MS, Math.round(end - t));
			}
			t += scene.durationMs;
		});
	}

	const layers = [];
	for (const { scene, layer, tokens, matches } of karaoke) {
		const layerStart = scene.startMs + (layer.startMs ?? 0);
		const layerDur = layer.durationMs ?? scene.durationMs - (layer.startMs ?? 0);
		const ends = matches.map((m) => (m ? m.endMs - layerStart : null));
		const matched = ends.filter((e) => e !== null).length;
		if (matched === 0) {
			layers.push({ scene: scene.id, words: tokens.length, matched, applied: false });
			continue;
		}

		const filled = ends.map((end, i) => {
			if (end !== null) return end;
			let prev = i - 1;
			while (prev >= 0 && ends[prev] === null) prev--;
			let next = i + 1;
			while (next < ends.length && ends[next] === null) next++;
			const fromV = prev >= 0 ? ends[prev] : 0;
			const toV = next < ends.length ? ends[next] : layerDur;

			return fromV + ((toV - fromV) * (i - prev)) / (next - prev);
		});

		let outOfWindow = 0;
		let last = 0;
		layer.wordEndsMs = filled.map((end) => {
			if (end <= 0 || end > layerDur) outOfWindow++;
			const clamped = Math.max(last + 1, Math.min(Math.round(end), layerDur));
			last = clamped;

			return clamped;
		});
		layers.push({ scene: scene.id, words: tokens.length, matched, outOfWindow, applied: true });
	}

	if (opts.chunk > 0) {
		// Feed-style captions: a few words at a time, each chunk on screen exactly while it is
		// spoken. A whole sentence in three lines reads as a transcript, not as an ad.
		for (const scene of spec.scenes) {
			scene.layers = scene.layers.flatMap((layer) => {
				if (layer.type !== "karaoke" || !layer.wordEndsMs) return [layer];
				const words = layer.text.split(/\s+/).filter(Boolean);
				const ends = layer.wordEndsMs;
				const base = layer.startMs ?? 0;
				const layerDur = layer.durationMs ?? scene.durationMs - base;
				const groups = [];
				let cur = [];
				words.forEach((w, i) => {
					cur.push(i);
					if (cur.length >= opts.chunk || (/[.,!?;:]$/.test(w) && cur.length >= 2)) groups.push(cur), (cur = []);
				});
				if (cur.length) groups.push(cur);
				return groups.map((g, gi) => {
					const from = g[0] === 0 ? 0 : ends[g[0] - 1];
					const to = gi === groups.length - 1 ? layerDur : ends[g.at(-1)];
					return {
						type: "karaoke",
						anim: layer.anim,
						text: g.map((i) => words[i]).join(" "),
						startMs: base + from,
						durationMs: Math.max(1, to - from),
						wordEndsMs: g.map((i) => Math.max(1, ends[i] - from)),
					};
				});
			});
		}
	}

	const out = opts.out ?? specPath;
	await writeJson(out, spec);
	const warnings = layers
		.filter((l) => !l.applied || l.outOfWindow > 0)
		.map((l) =>
			l.applied
				? `cena ${l.scene}: ${l.outOfWindow} palavra(s) faladas fora do tempo da cena — rode com --fit-scenes ou ajuste o atMs da voz`
				: `cena ${l.scene}: nenhuma palavra da legenda bate com a fala — confira o texto`,
		);
	const durationMs = spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
	console.log(JSON.stringify({ out, offsetMs, fitScenes: Boolean(opts.fitScenes), durationMs, layers, warnings }, null, 2));
}


// ---------------------------------------------------------------------------------------
// footage — acabamento de spec feito de takes gravados. MESMA lógica da plataforma
// (server/src/lib/footage.ts): corte puxado pra fronteira de palavra (a palavra fica se a
// maior parte dela está dentro do trecho), clipes seguidos do mesmo take sem sobreposição (a
// fala tocaria duas vezes) e legenda refeita da fala real em blocos (`karaoke` com auto:true).
// Rode depois de TODA mudança no spec — as legendas automáticas antigas são jogadas fora.
// ---------------------------------------------------------------------------------------

const LEAD_MS = 60;
const TAIL_MS = 120;
const GAP_BREAK_MS = 350;

const wordAt = (words, ms) => words.find((w) => ms > w.startMs && ms < w.endMs);

function snapClip(scene, layer, take) {
	let inMs = layer.startFromMs ?? 0;
	let outMs = inMs + scene.durationMs;
	const cutIn = wordAt(take.words, inMs);
	if (cutIn) {
		// A folga nunca invade a palavra anterior — senão rodar de novo move o corte.
		const prev = take.words.filter((w) => w.endMs <= cutIn.startMs).at(-1);
		inMs = inMs - cutIn.startMs <= cutIn.endMs - inMs ? Math.max(prev?.endMs ?? 0, cutIn.startMs - LEAD_MS) : cutIn.endMs;
	}
	const cutOut = wordAt(take.words, outMs);
	if (cutOut) {
		if (outMs - cutOut.startMs >= cutOut.endMs - outMs) {
			const next = take.words.find((w) => w.startMs >= cutOut.endMs);
			outMs = Math.min(cutOut.endMs + TAIL_MS, next ? next.startMs - 20 : Infinity);
		} else {
			outMs = cutOut.startMs - 20;
		}
	}
	outMs = Math.min(outMs, take.durationMs);
	inMs = Math.min(inMs, Math.max(0, outMs - 300));
	layer.startFromMs = Math.round(inMs);
	scene.durationMs = Math.max(300, Math.round(outMs - inMs));
}

const cleanWord = (w) => w.replace(/^[,.;:!?…"“”]+|[,.;…"“”]+$/g, "");

function captionLayers(words, inMs, sceneMs, maxWords) {
	const inside = words
		// Só a palavra majoritariamente dentro do clipe (a sobra de uma palavra cortada não é fala).
		.filter((w) => Math.min(w.endMs, inMs + sceneMs) - Math.max(w.startMs, inMs) >= Math.max(1, w.endMs - w.startMs) / 2)
		.map((w) => ({ text: cleanWord(w.word), start: Math.max(0, w.startMs - inMs), end: Math.min(sceneMs, w.endMs - inMs), raw: w.word }))
		.filter((w) => w.text);
	const blocks = [];
	let cur = [];
	for (const [i, w] of inside.entries()) {
		cur.push(w);
		const next = inside[i + 1];
		if (!next || cur.length >= maxWords || /[.!?…]$/.test(w.raw) || next.start - w.end > GAP_BREAK_MS) {
			blocks.push(cur);
			cur = [];
		}
	}

	return blocks.map((b, i) => {
		const start = Math.round(b[0].start);
		const nextStart = blocks[i + 1]?.[0].start;
		const end = Math.round(nextStart !== undefined && nextStart - b.at(-1).end < GAP_BREAK_MS ? nextStart : b.at(-1).end + 150);

		return {
			type: "karaoke",
			auto: true,
			text: b.map((w) => w.text).join(" "),
			startMs: start,
			durationMs: Math.max(200, Math.min(sceneMs - start, end - start)),
			wordEndsMs: b.map((w) => Math.max(1, Math.round(w.end - start))),
		};
	});
}

async function cmdFootage(specPath, opts) {
	const spec = await readJson(specPath);
	const cache = new Map();
	const takeFor = async (src) => {
		if (cache.has(src)) return cache.get(src);
		const abs = publicPath(specPath, src);
		let take = null;
		if (abs && existsSync(abs)) {
			const durationMs = await probeDurationMs(abs);
			const wordsFile = abs.replace(/\.[^.]+$/, ".words.json");
			const words = existsSync(wordsFile) ? (await readJson(wordsFile)).words ?? [] : [];
			if (durationMs) take = { durationMs, words, hasWords: existsSync(wordsFile) };
		}
		cache.set(src, take);

		return take;
	};

	const auto = spec.autoCaptions ?? { enabled: true };
	const maxWords = auto.maxWords ?? 4;
	const report = [];
	const mains = [];
	for (const scene of spec.scenes) {
		for (const l of scene.layers) if (l.type === "footage" && typeof l.startFromMs === "number") l.startFromMs = Math.max(0, Math.round(l.startFromMs));
		scene.layers = scene.layers.filter((l) => !(l.type === "karaoke" && l.auto));
		const main = scene.layers.find((l) => l.type === "footage" && !l.startMs && !l.durationMs);
		if (!main) continue;
		const take = await takeFor(main.src);
		if (!take) {
			report.push(`cena ${scene.id}: take "${main.src}" não achado em render/public/ (URL externa fica sem acabamento)`);
			continue;
		}
		if (!take.hasWords) report.push(`cena ${scene.id}: sem ${main.src.replace(/\.[^.]+$/, ".words.json")} — rode tools/takes.mjs preparar`);
		snapClip(scene, main, take);
		mains.push({ scene, layer: main, take });
	}
	for (let i = 0; i + 1 < mains.length; i++) {
		const a = mains[i];
		const b = mains[i + 1];
		if (a.layer.src !== b.layer.src || spec.scenes.indexOf(b.scene) !== spec.scenes.indexOf(a.scene) + 1) continue;
		const aIn = a.layer.startFromMs ?? 0;
		const bIn = b.layer.startFromMs ?? 0;
		if (bIn >= aIn && aIn + a.scene.durationMs > bIn) a.scene.durationMs = Math.max(300, bIn - aIn);
	}
	let captions = 0;
	for (const { scene, layer, take } of mains) {
		if (auto.enabled !== false && (layer.volume ?? 1) > 0 && take.words.length) {
			const caps = captionLayers(take.words, layer.startFromMs ?? 0, scene.durationMs, maxWords);
			scene.layers.push(...caps);
			captions += caps.length;
		}
	}
	if (!spec.autoCaptions) spec.autoCaptions = { enabled: true, maxWords };
	let cursor = 0;
	for (const s of spec.scenes) {
		s.startMs = cursor;
		cursor += s.durationMs;
	}
	const out = opts.out ?? specPath;
	await writeJson(out, spec);
	console.log(JSON.stringify({ out, clips: mains.length, captionBlocks: captions, durationMs: cursor, warnings: report }, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
	const i = rest.indexOf(`--${name}`);

	return i === -1 ? undefined : rest[i + 1];
};

const commands = {
	props: () => cmdProps(rest[0], flag("out")),
	validate: () => cmdValidate(rest[0]),
	check: () => cmdCheck(rest[0]),
	variant: () =>
		cmdVariant(rest[0], {
			mutation: flag("mutation") ?? "manual",
			patch: flag("patch"),
			id: flag("id"),
			out: flag("out"),
		}),
	diff: () => cmdDiff(rest[0], rest[1]),
	footage: () => cmdFootage(rest[0], { out: flag("out") }),
	"sync-captions": () => cmdSyncCaptions(rest[0], { words: flag("words"), out: flag("out"), fitScenes: rest.includes("--fit-scenes"), chunk: Number(flag("chunk") ?? 0) }),
};

if (!commands[cmd]) {
	console.error("comandos: props | validate | check | variant | diff | sync-captions | footage");
	process.exit(1);
}

commands[cmd]().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
