#!/usr/bin/env node
/**
 * Quick pass/fail read on a rendered video, before a human has to watch the whole thing.
 *
 * A contact sheet answers "is something actually on screen in every scene" at a glance — the
 * bug that prompted this tool was a video where only the first 5s had a generated clip and the
 * rest was blank behind captions, which is invisible in a spec review but obvious in a sheet.
 * volumedetect/silencedetect answer "is the voiceover actually there and audible."
 *
 * Usage:
 *   node tools/review.mjs <video.mp4> [--out pasta] [--cols 4] [--rows 3]
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

// ffmpeg's drawtext needs an explicit font on Windows — there is no fontconfig default here,
// so without this it fails with "Cannot load default config file" on every single frame.
const WIN_FONT = "C:/Windows/Fonts/arial.ttf";
const FONTFILE = existsSync(WIN_FONT) ? WIN_FONT.replace(/:/g, "\\:") : null;

function parseArgs(argv) {
	const args = { cols: 4, rows: 3 };
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--out") args.out = argv[++i];
		else if (a === "--cols") args.cols = Number(argv[++i]);
		else if (a === "--rows") args.rows = Number(argv[++i]);
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

const fmtTime = (sec) => {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);

	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** One frame, optionally with the timestamp burned in. Throws if drawtext itself fails. */
async function extractFrame(video, atSec, outPath, withText) {
	const args = ["-y", "-ss", String(atSec), "-i", video, "-frames:v", "1"];
	const vf = ["scale=480:-2"];
	if (withText && FONTFILE) {
		// A literal string, not %{pts} — we already know the timestamp, so this sidesteps
		// ffmpeg's pts formatting and timezone quirks entirely.
		const label = fmtTime(atSec).replace(/:/g, "\\:");
		vf.push(
			`drawtext=fontfile='${FONTFILE}':text='${label}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`,
		);
	} else if (withText && !FONTFILE) {
		throw new Error("sem fonte disponível para drawtext");
	}
	args.push("-vf", vf.join(","), outPath);
	await run("ffmpeg", args, { maxBuffer: MAX_BUFFER });
}

/** Stitches N single-frame images (in order) into one cols×rows sheet via concat+tile. */
async function buildSheet(thumbPaths, cols, rows, sheetPath) {
	const inputs = thumbPaths.flatMap((p) => ["-i", p]);
	const n = thumbPaths.length;
	const labels = thumbPaths.map((_, i) => `[${i}:v]`).join("");
	const filter = `${labels}concat=n=${n}:v=1:a=0,tile=${cols}x${rows}`;
	await run(
		"ffmpeg",
		["-y", ...inputs, "-filter_complex", filter, "-frames:v", "1", sheetPath],
		{ maxBuffer: MAX_BUFFER },
	);
}

/** Mean/max volume in dB, via ffmpeg's volumedetect (reads its own stderr, not stdout). */
async function volumeStats(video) {
	const { stderr } = await run(
		"ffmpeg",
		["-i", video, "-af", "volumedetect", "-f", "null", "-"],
		{ maxBuffer: MAX_BUFFER },
	).catch((e) => ({ stderr: e.stderr ?? "" }));

	const mean = stderr.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
	const max = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/);

	return {
		meanVolumeDb: mean ? Number(mean[1]) : null,
		maxVolumeDb: max ? Number(max[1]) : null,
	};
}

/** Silence spans below -40dB lasting 0.8s+ — long enough to be a hole, not just a word gap. */
async function silenceSpans(video) {
	const { stderr } = await run(
		"ffmpeg",
		["-i", video, "-af", "silencedetect=n=-40dB:d=0.8", "-f", "null", "-"],
		{ maxBuffer: MAX_BUFFER },
	).catch((e) => ({ stderr: e.stderr ?? "" }));

	const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
	const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));

	return starts.map((startSec, i) => ({ startSec, endSec: ends[i] ?? null }));
}

async function main() {
	const { video, out, cols, rows } = parseArgs(process.argv.slice(2));
	if (!video) throw new Error("uso: review.mjs <video.mp4> [--out pasta] [--cols 4] [--rows 3]");
	if (!existsSync(video)) throw new Error(`vídeo não encontrado: ${video}`);

	const outDir = out ?? dirname(resolve(video));
	await mkdir(outDir, { recursive: true });
	const name = basename(video, extname(video));
	const sheetPath = join(resolve(outDir), `${name}.sheet.png`);

	const info = await probe(video);
	const n = cols * rows;
	// Centered slices, not the raw edges — a frame AT t=0 or t=duration is usually a cut/black
	// frame, and the point of the sheet is to show what a viewer actually sees.
	const timestamps = Array.from({ length: n }, (_, i) => (i + 0.5) * (info.durationSec / n));

	// Scratch dir for the individual frames; never left behind once the sheet is built.
	const tmpDir = join(outDir, `.review-${Date.now()}`);
	await mkdir(tmpDir, { recursive: true });

	let withText = true;
	const thumbPaths = timestamps.map((_, i) => join(tmpDir, `f${String(i).padStart(2, "0")}.png`));

	try {
		try {
			await Promise.all(
				timestamps.map((t, i) => extractFrame(video, t, thumbPaths[i], true)),
			);
		} catch {
			// drawtext failed (commonly: no usable font on this Windows install) — fall back to
			// plain frames and let the JSON's `frames` list carry the timestamps instead.
			withText = false;
			await Promise.all(
				timestamps.map((t, i) => extractFrame(video, t, thumbPaths[i], false)),
			);
		}

		await buildSheet(thumbPaths, cols, rows, sheetPath);
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}

	const audio = info.hasAudio
		? { hasAudio: true, ...(await volumeStats(video)), silences: await silenceSpans(video) }
		: { hasAudio: false, meanVolumeDb: null, maxVolumeDb: null, silences: [] };

	const result = {
		sheet: sheetPath,
		durationSec: info.durationSec,
		width: info.width,
		height: info.height,
		fps: info.fps,
		withText,
		frames: timestamps.map((atSec, index) => ({ index, atSec })),
		audio,
	};

	console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
	console.error(`erro: ${err.message}`);
	process.exit(1);
});
