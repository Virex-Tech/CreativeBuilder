import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FORMAT_SIZES, formatOf, layoutFor, withFormat } from "../src/formats";

describe("formats", () => {
	it("FORMAT_SIZES", () => {
		assert.deepEqual(FORMAT_SIZES, {
			VERTICAL: { w: 1080, h: 1920 },
			PORTRAIT: { w: 1080, h: 1350 },
			SQUARE: { w: 1080, h: 1080 },
		});
		assert.equal(formatOf(1080, 1350), "PORTRAIT");
		assert.equal(formatOf(720, 1280), null);
	});

	it("withFormat changes only w/h and does not mutate", () => {
		const spec = { specVersion: "1", format: { w: 1080, h: 1920, fps: 30 }, scenes: [] };
		const sq = withFormat(spec, "SQUARE");
		assert.deepEqual(sq.format, { w: 1080, h: 1080, fps: 30 });
		assert.equal(spec.format.h, 1920);
		assert.equal(sq.scenes, spec.scenes);
		assert.throws(() => withFormat(spec, "WIDE" as never), /formato desconhecido/);
	});

	it("9:16 layout is the identity (renders stay pixel-identical)", () => {
		const L = layoutFor(1080, 1920);
		for (const px of [0, 22, 60, 230, 250, 350, 420, 580, 640]) {
			assert.equal(L.size(px), px);
			assert.equal(L.top(px), px);
			assert.equal(L.bottom(px), px);
			assert.equal(L.x(px), px);
		}
	});

	it("shorter frames keep bands inside the frame and ordered", () => {
		for (const { w, h } of [FORMAT_SIZES.PORTRAIT, FORMAT_SIZES.SQUARE]) {
			const L = layoutFor(w, h);
			assert.ok(L.s <= 1 && L.s > 0.7);
			// caption band < hook < CTA from the bottom; all well inside the frame
			assert.ok(L.bottom(420) < L.bottom(580) && L.bottom(580) < L.bottom(640) && L.bottom(640) < h / 2);
			assert.ok(L.top(250) < h / 4);
		}
		assert.equal(layoutFor(1080, 1350).s, 1);
		assert.equal(layoutFor(1080, 1080).s, 0.8);
	});
});

describe("top band: title_top under a badge", async () => {
	const { titleUnderBadge } = await import("../src/layers/topBand");
	const title = { type: "text", preset: "title_top", content: "t", anim: "none" } as const;
	const badge = (extra: Record<string, unknown> = {}) => ({ type: "badge", label: "", value: "1", anim: "none", ...extra }) as never;

	it("stacks only when both are on screen at the same time", () => {
		assert.deepEqual(titleUnderBadge(title, [badge()], 3000), { badgeWithLabel: false });
		assert.deepEqual(titleUnderBadge(title, [badge({ label: "semana" })], 3000), { badgeWithLabel: true });
		assert.equal(titleUnderBadge(title, [], 3000), undefined);
		assert.equal(titleUnderBadge({ ...title, startMs: 0, durationMs: 1000 }, [badge({ startMs: 1000 })], 3000), undefined);
		assert.deepEqual(titleUnderBadge({ ...title, startMs: 0, durationMs: 1200 }, [badge({ startMs: 1000 })], 3000), { badgeWithLabel: false });
		assert.equal(titleUnderBadge({ ...title, preset: "sub" }, [badge()], 3000), undefined);
	});
});
