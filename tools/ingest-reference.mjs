#!/usr/bin/env node
/**
 * Turns a reference video into something Claude can actually read.
 *
 * Claude cannot watch an MP4. It CAN read images. So this extracts the reference into
 * frames at real cut points plus the audio, and writes a manifest describing the timeline.
 * Claude then reads the frames and writes the blueprint (beats, pacing, on-screen text).
 *
 * Cuts are detected with ffmpeg's scene filter rather than sampled on a fixed interval,
 * because the whole point is to capture WHERE the editor cut — a frame grabbed every 2s
 * would miss the fast hook cuts that make or break a creative.
 *
 * Usage:
 *   node tools/ingest-reference.mjs <video> [--out dir] [--threshold 0.30] [--max 24]
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

function parseArgs(argv) {
	const args = { threshold: 0.3, max: 24 };
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--out") args.out = argv[++i];
		else if (a === "--threshold") args.threshold = Number(argv[++i]);
		else if (a === "--max") args.max = Number(argv[++i]);
		else rest.push(a);
	}
	args.video = rest[0];

	return args;
}

async function probe(video) {
	const { stdout } = await run("ffprobe", [
		"-v", "error",
		"-show_entries", "format=duration",
		"-show_entries", "stream=width,height,r_frame_rate,codec_type",
		"-of", "json",
		video,
	]);
	const data = JSON.parse(stdout);
	const v = data.streams.find((s) => s.codec_type === "video") ?? {};
	const hasAudio = data.streams.some((s) => s.codec_type === "audio");

	return {
		durationSec: Number(data.format.duration),
		width: v.width,
		height: v.height,
		fps: v.r_frame_rate ? eval(v.r_frame_rate) : null, // e.g. "30/1"
		hasAudio,
	};
}

/** Scene-change timestamps, in seconds. */
async function detectCuts(video, threshold) {
	// showinfo prints one line per frame that passes the scene filter.
	const { stderr } = await run(
		"ffmpeg",
		["-i", video, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
		{ maxBuffer: 64 * 1024 * 1024 },
	).catch((e) => ({ stderr: e.stderr ?? "" }));

	const cuts = [];
	for (const m of stderr.matchAll(/pts_time:([0-9.]+)/g)) {
		cuts.push(Number(m[1]));
	}

	return cuts;
}

async function extractFrame(video, timeSec, outPath) {
	await run("ffmpeg", [
		"-y",
		"-ss", String(timeSec),
		"-i", video,
		"-frames:v", "1",
		// Downscale: Claude reads these, and a 1080x1920 PNG per cut burns context for
		// detail that does not change the blueprint.
		"-vf", "scale=540:-2",
		"-q:v", "3",
		outPath,
	]);
}

async function extractAudio(video, outPath) {
	await run("ffmpeg", ["-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", outPath]);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.video) {
		console.error("uso: node tools/ingest-reference.mjs <video> [--out dir] [--threshold 0.3] [--max 24]");
		process.exit(1);
	}

	const video = resolve(args.video);
	const name = basename(video).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
	const outDir = resolve(args.out ?? join("references", name));
	await mkdir(join(outDir, "frames"), { recursive: true });

	const meta = await probe(video);
	const cuts = await detectCuts(video, args.threshold);

	// Always include the very first frame: the hook starts at 0, and the scene filter
	// never reports it as a "change".
	const marks = [0, ...cuts].filter((t) => t < meta.durationSec);

	// Keep it readable: too many frames drown the analysis, so thin evenly when over max.
	const step = Math.max(1, Math.ceil(marks.length / args.max));
	const picked = marks.filter((_, i) => i % step === 0);

	// Grab slightly AFTER the cut. Landing exactly on it catches the middle of a fade or a
	// whip pan — a washed-out or motion-blurred frame that says nothing about the shot.
	const SETTLE_SEC = 0.35;

	const frames = [];
	for (const [i, t] of picked.entries()) {
		const at = Math.min(t + SETTLE_SEC, Math.max(0, meta.durationSec - 0.1));
		const file = join("frames", `${String(i).padStart(2, "0")}_${at.toFixed(2)}s.jpg`);
		await extractFrame(video, at, join(outDir, file));
		frames.push({ index: i, cutAtSec: Number(t.toFixed(2)), atSec: Number(at.toFixed(2)), file });
	}

	let audioFile = null;
	if (meta.hasAudio) {
		audioFile = "audio.wav";
		await extractAudio(video, join(outDir, audioFile));
	}

	const manifest = {
		source: video,
		...meta,
		cutCount: cuts.length,
		// Average shot length is the single most transferable pacing number in a reference.
		avgShotSec: cuts.length ? Number((meta.durationSec / (cuts.length + 1)).toFixed(2)) : null,
		frames,
		audioFile,
	};
	await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, "\t"));

	console.log(JSON.stringify({ outDir, ...manifest, frames: frames.length }, null, 2));
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
