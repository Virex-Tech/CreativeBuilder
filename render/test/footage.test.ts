import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captionLayers, finalizeFootage, footageTakeIds, type FootageTakeInput } from "../src/footage";

// Take "t1": 10s, words at known places. Gaps: 1000–1300 (300ms), 2600–3200 (600ms = pause).
const words = [
	{ w: "Eu", startMs: 500, endMs: 700 },
	{ w: "treino", startMs: 700, endMs: 1000 },
	{ w: "todo", startMs: 1300, endMs: 1600 },
	{ w: "dia.", startMs: 1600, endMs: 2000 },
	{ w: "Você", startMs: 2100, endMs: 2400 },
	{ w: "também", startMs: 2400, endMs: 2600 },
	{ w: "pode", startMs: 3200, endMs: 3500 },
	{ w: "começar", startMs: 3500, endMs: 4000 },
	{ w: "hoje", startMs: 4000, endMs: 4300 },
	{ w: "mesmo", startMs: 4300, endMs: 4600 },
	{ w: "agora", startMs: 4600, endMs: 5000 },
];
const T1: FootageTakeInput = { id: "t1", src: "https://cdn/t1.mp4", durationMs: 10_000, words };

const scene = (id: string, durationMs: number, layers: unknown[]) => ({ id, role: "POINT", startMs: 0, durationMs, layers });
const clip = (startFromMs: number, extra: Record<string, unknown> = {}) => ({ type: "footage", takeId: "t1", src: "typo.mp4", startFromMs, ...extra });
const spec = (scenes: ReturnType<typeof scene>[], extra: Record<string, unknown> = {}) => ({ specVersion: "1", creativeId: "c", appId: "a", scenes, ...extra });

const footageOf = (s: { layers: unknown[] }) => s.layers.find((l) => (l as { type: string }).type === "footage") as { startFromMs: number; src: string };
const captionsOf = (s: { layers: unknown[] }) =>
	s.layers.filter((l) => (l as { type: string; auto?: boolean }).type === "karaoke") as { text: string; startMs: number; durationMs: number; wordEndsMs: number[]; auto?: boolean }[];

describe("finalizeFootage — snapping", () => {
	it("cut-in in the first half of a word keeps the word, with lead but never into the previous word", () => {
		// 750 is inside "treino" (700–1000), closer to its start → keep it, pull to max(prevEnd=700, 700-60).
		const { spec: out } = finalizeFootage(spec([scene("a", 1000, [clip(750)])]), [T1]);
		assert.equal(footageOf(out.scenes[0]).startFromMs, 700);
	});

	it("cut-in in the second half of a word drops the word", () => {
		// 950 inside "treino", closer to its end → start right after it.
		const { spec: out } = finalizeFootage(spec([scene("a", 1000, [clip(950)])]), [T1]);
		assert.equal(footageOf(out.scenes[0]).startFromMs, 1000);
	});

	it("cut-in before the first word gets the lead; no previous word = floor at 0", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 1000, [clip(520)])]), [T1]);
		assert.equal(footageOf(out.scenes[0]).startFromMs, 440);
	});

	it("cut-out mostly inside a word keeps it + tail, never touching the next word", () => {
		// in 1300, out 1300+500=1800 inside "dia." (1600–2000), closer to end → keep: min(2000+120, next 2100-20) = 2080.
		const { spec: out } = finalizeFootage(spec([scene("a", 500, [clip(1300)])]), [T1]);
		assert.equal(out.scenes[0].durationMs, 780);
	});

	it("cut-out mostly outside a word drops it (ends 20ms before it)", () => {
		// out 1300+350=1650 inside "dia." near its start → 1600-20 = 1580 → 280 → min clip 300.
		const { spec: out } = finalizeFootage(spec([scene("a", 350, [clip(1300)])]), [T1]);
		assert.equal(out.scenes[0].durationMs, 300);
	});

	it("never runs past the end of the take", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 5000, [clip(8000)])]), [T1]);
		assert.equal(out.scenes[0].durationMs, 2000);
	});

	it("is idempotent (running it again does not move the cut)", () => {
		const once = finalizeFootage(spec([scene("a", 1300, [clip(760)]), scene("b", 900, [clip(2150)])]), [T1]).spec;
		const twice = finalizeFootage(once, [T1]).spec;
		assert.deepEqual(twice, once);
	});
});

describe("finalizeFootage — overlap and src", () => {
	it("trims the earlier of two consecutive clips of the same take so speech never plays twice", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 2000, [clip(1300)]), scene("b", 1000, [clip(2100)])]), [T1]);
		// Cuts exactly on a word boundary stay put: a = 1300.., b = 2100..
		assert.equal(footageOf(out.scenes[0]).startFromMs, 1300);
		// a would run to 3180 (drops "pode"), past b's in-point → a ends where b starts.
		const aIn = footageOf(out.scenes[0]).startFromMs;
		const bIn = footageOf(out.scenes[1]).startFromMs;
		assert.equal(out.scenes[0].durationMs, bIn - aIn);
	});

	it("does not trim across different takes", () => {
		const t2: FootageTakeInput = { ...T1, id: "t2", src: "https://cdn/t2.mp4" };
		const { spec: out } = finalizeFootage(
			spec([scene("a", 2000, [clip(1300)]), scene("b", 1000, [clip(2100, { takeId: "t2" })])]),
			[T1, t2],
		);
		assert.ok(out.scenes[0].durationMs > 1000);
	});

	it("fixes src from the take (by takeId) and reflows startMs", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 1000, [clip(1300)]), scene("b", 1000, [clip(4000)])]), [T1]);
		assert.equal(footageOf(out.scenes[0]).src, "https://cdn/t1.mp4");
		assert.equal(out.scenes[1].startMs, out.scenes[0].durationMs);
	});

	it("a layer without takeId matches a take by src", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 1000, [{ type: "footage", src: "https://cdn/t1.mp4", startFromMs: 950 }])]), [T1]);
		assert.equal(footageOf(out.scenes[0]).startFromMs, 1000);
	});

	it("unknown take → warning, clip left as is", () => {
		const r = finalizeFootage(spec([scene("a", 1000, [clip(950, { takeId: "nope" })])]), [T1]);
		assert.equal(footageOf(r.spec.scenes[0]).startFromMs, 950);
		assert.match(r.warnings[0], /cena a: take "nope" desconhecido/);
	});

	it("does not mutate its input", () => {
		const input = spec([scene("a", 1000, [clip(750)])]);
		const copy = JSON.parse(JSON.stringify(input));
		finalizeFootage(input, [T1]);
		assert.deepEqual(input, copy);
	});

	it("a spec without footage comes back unchanged", () => {
		const input = spec([scene("a", 1000, [{ type: "karaoke", auto: true, text: "oi" }])]);
		assert.deepEqual(finalizeFootage(input, [T1]).spec, input);
	});

	it("footageTakeIds lists the referenced takes once", () => {
		assert.deepEqual(footageTakeIds(spec([scene("a", 1000, [clip(0)]), scene("b", 1000, [clip(0), clip(0, { takeId: "t9" })])])), ["t1", "t9"]);
	});
});

describe("finalizeFootage — captions", () => {
	it("rebuilds auto captions from the speech in blocks, breaking on sentence end and pauses", () => {
		const s = spec([scene("a", 4700, [clip(400), { type: "karaoke", auto: true, text: "velha" }, { type: "karaoke", text: "manual" }])], {
			autoCaptions: { enabled: true, maxWords: 4 },
		});
		const { spec: out, stats } = finalizeFootage(s, [T1]);
		const caps = captionsOf(out.scenes[0]);
		assert.equal(caps[0].text, "manual"); // manual karaoke survives
		const auto = caps.filter((c) => c.auto);
		// "dia." ends a sentence; 600ms pause before "pode"; "hoje mesmo agora" hits maxWords with "começar"
		assert.deepEqual(
			auto.map((c) => c.text),
			["Eu treino todo dia", "Você também", "pode começar hoje mesmo", "agora"],
		);
		assert.equal(stats.captionBlocks, 4);
		// timings are relative to the clip in-point, word ends relative to the block start
		assert.equal(auto[0].startMs, 500 - 400);
		assert.deepEqual(auto[0].wordEndsMs, [200, 500, 1100, 1500]);
		// a block stays until the next one starts when the gap is short ("dia." → "Você": 100ms)
		assert.equal(auto[0].durationMs, 2100 - 500);
	});

	it("respects maxWords", () => {
		const { spec: out } = finalizeFootage(spec([scene("a", 4700, [clip(400)])], { autoCaptions: { enabled: true, maxWords: 1 } }), [T1]);
		assert.ok(captionsOf(out.scenes[0]).every((c) => c.text.split(" ").length === 1));
	});

	it("no captions when disabled or the clip is muted; autoCaptions default is written", () => {
		const off = finalizeFootage(spec([scene("a", 2000, [clip(400)])], { autoCaptions: { enabled: false } }), [T1]).spec;
		assert.equal(captionsOf(off.scenes[0]).length, 0);
		const muted = finalizeFootage(spec([scene("a", 2000, [clip(400, { volume: 0 })])]), [T1]).spec;
		assert.equal(captionsOf(muted.scenes[0]).length, 0);
		assert.deepEqual((muted as { autoCaptions?: unknown }).autoCaptions, { enabled: true, maxWords: 4 });
	});

	it("accepts the transcriber's `word` field as well as `w`", () => {
		const legacy = { ...T1, words: words.map(({ w, ...rest }) => ({ word: w, ...rest })) };
		const a = finalizeFootage(spec([scene("a", 4700, [clip(400)])]), [T1]).spec;
		const b = finalizeFootage(spec([scene("a", 4700, [clip(400)])]), [legacy]).spec;
		assert.deepEqual(b, a);
	});

	it("a word only half inside the clip is not captioned", () => {
		// clip 0..1850: "dia." (1600–2000) is 250/400 inside → captioned; with 0..1750 it is 150/400 → not.
		const caps = captionLayers(
			words.map((x) => ({ ...x })),
			0,
			1750,
			8,
		);
		assert.equal(caps.map((c) => c.text).join(" "), "Eu treino todo");
	});
});
