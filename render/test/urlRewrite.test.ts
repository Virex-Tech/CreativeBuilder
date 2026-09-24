import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRewriteRules, rewriteSpecUrls, rewriteUrl } from "../src/urlRewrite";

describe("RENDER_URL_REWRITE", () => {
	it("parses from=>to;from2=>to2 (spaces and blanks ignored)", () => {
		assert.deepEqual(parseRewriteRules(" https://pub.example/uploads/ => http://api:3000/uploads/ ;; https://cdn.x/=>http://cdn:80/ "), [
			{ from: "https://pub.example/uploads/", to: "http://api:3000/uploads/" },
			{ from: "https://cdn.x/", to: "http://cdn:80/" },
		]);
		assert.deepEqual(parseRewriteRules(undefined), []);
		assert.deepEqual(parseRewriteRules("  "), []);
	});

	it("rejects a malformed rule (fails at boot, not mid-render)", () => {
		assert.throws(() => parseRewriteRules("https://a/"), /inválido/);
		assert.throws(() => parseRewriteRules("=>http://b/"), /inválido/);
	});

	it("rewrites by prefix, first match wins, no match = unchanged", () => {
		const rules = parseRewriteRules("https://a.example/up/=>http://api/up/;https://a.example/=>http://other/");
		assert.equal(rewriteUrl("https://a.example/up/x.mp4", rules), "http://api/up/x.mp4");
		assert.equal(rewriteUrl("https://a.example/y.png", rules), "http://other/y.png");
		assert.equal(rewriteUrl("broll/local.mp4", rules), "broll/local.mp4");
	});

	it("rewrites every media src in a spec without mutating it", () => {
		const P = "https://pub.example/uploads/";
		const spec = {
			specVersion: "1",
			scenes: [
				{
					id: "a",
					layers: [
						{ type: "footage", src: `${P}take.mp4` },
						{ type: "generative_video", prompt: "x", src: `${P}broll.mp4` },
						{ type: "app_screen_recording", src: `${P}screen.png` },
						{ type: "generative_video", prompt: "sem src" },
						{ type: "text", content: `${P}not-a-src` },
					],
				},
			],
			audio: { voiceover: { src: `${P}vo.mp3`, atMs: 0 }, music: { src: "music/local.mp3" }, sfx: [{ src: `${P}pop.mp3`, atMs: 10 }] },
		};
		const before = JSON.stringify(spec);
		const out = rewriteSpecUrls(spec, parseRewriteRules(`${P}=>http://api:3000/uploads/`));
		assert.equal(JSON.stringify(spec), before);
		const layers = out.scenes[0].layers as { src?: string; content?: string }[];
		assert.equal(layers[0].src, "http://api:3000/uploads/take.mp4");
		assert.equal(layers[1].src, "http://api:3000/uploads/broll.mp4");
		assert.equal(layers[2].src, "http://api:3000/uploads/screen.png");
		assert.equal(layers[3].src, undefined);
		assert.equal(layers[4].content, `${P}not-a-src`);
		assert.equal(out.audio.voiceover.src, "http://api:3000/uploads/vo.mp3");
		assert.equal(out.audio.music.src, "music/local.mp3");
		assert.equal(out.audio.sfx[0].src, "http://api:3000/uploads/pop.mp3");
	});

	it("no rules → the same object", () => {
		const spec = { scenes: [{ layers: [] }] };
		assert.equal(rewriteSpecUrls(spec, []), spec);
	});
});
