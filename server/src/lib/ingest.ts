import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

/**
 * Server-side port of tools/ingest-reference.mjs.
 *
 * Turns a reference video into something an AI agent can actually read: frames grabbed at
 * the real cut points (not on a fixed interval — that misses the fast hook cuts) plus the
 * audio, and a manifest describing the timeline. The agent then reads the frames and writes
 * the blueprint; it never watches the MP4.
 *
 * The logic is intentionally identical to the local CLI so a reference ingested on a laptop
 * and one ingested by the worker produce the same manifest.
 */

const run = promisify(execFile);

export interface IngestOptions {
	/** Scene-change sensitivity for ffmpeg's scene filter (0..1). Lower = more cuts. */
	threshold?: number;
	/** Cap on extracted frames; the timeline is thinned evenly when it would exceed this. */
	max?: number;
}

export interface IngestFrame {
	index: number;
	cutAtSec: number;
	atSec: number;
	file: string;
}

export interface IngestManifest {
	durationSec: number;
	width: number | null;
	height: number | null;
	fps: number | null;
	hasAudio: boolean;
	cutCount: number;
	/** Average shot length — the single most transferable pacing number in a reference. */
	avgShotSec: number | null;
	frames: IngestFrame[];
	audioFile: string | null;
	/** Fala da referência (whisper, preenchida pelo worker quando há áudio). */
	transcript?: { language?: string; text: string };
}

export interface Probe {
	durationSec: number;
	width: number | null;
	height: number | null;
	fps: number | null;
	hasAudio: boolean;
}

/** Parses ffprobe's "30/1" frame-rate form without eval(). */
function parseFps(raw: string | undefined): number | null {
	if (!raw) return null;
	const [num, den] = raw.split("/").map(Number);
	if (!num || !den) return null;

	return Number((num / den).toFixed(3));
}

export async function probe(video: string): Promise<Probe> {
	const { stdout } = await run("ffprobe", [
		"-v", "error",
		"-show_entries", "format=duration",
		"-show_entries", "stream=width,height,r_frame_rate,codec_type",
		"-of", "json",
		video,
	]);
	const data = JSON.parse(stdout) as {
		format: { duration: string };
		streams: { width?: number; height?: number; r_frame_rate?: string; codec_type: string }[];
	};
	const v = data.streams.find((s) => s.codec_type === "video") ?? { codec_type: "video" };

	return {
		durationSec: Number(data.format.duration),
		width: v.width ?? null,
		height: v.height ?? null,
		fps: parseFps(v.r_frame_rate),
		hasAudio: data.streams.some((s) => s.codec_type === "audio"),
	};
}

/** Scene-change timestamps, in seconds. */
async function detectCuts(video: string, threshold: number): Promise<number[]> {
	const { stderr } = await run(
		"ffmpeg",
		["-i", video, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
		{ maxBuffer: 64 * 1024 * 1024 },
	).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));

	const cuts: number[] = [];
	for (const m of stderr.matchAll(/pts_time:([0-9.]+)/g)) cuts.push(Number(m[1]));

	return cuts;
}

async function extractFrame(video: string, timeSec: number, outPath: string): Promise<void> {
	await run("ffmpeg", [
		"-y",
		"-ss", String(timeSec),
		"-i", video,
		"-frames:v", "1",
		// Downscale: the agent reads these, and a full-res PNG per cut burns context for
		// detail that does not change the blueprint.
		"-vf", "scale=540:-2",
		"-q:v", "3",
		outPath,
	]);
}

async function extractAudio(video: string, outPath: string): Promise<void> {
	await run("ffmpeg", ["-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", outPath]);
}

/**
 * Extracts frames + audio from `video` into `outDir`, returning the manifest. Paths in the
 * manifest are relative to `outDir` so it can be served regardless of where it lives.
 */
export async function ingestVideo(
	video: string,
	outDir: string,
	options: IngestOptions = {},
): Promise<IngestManifest> {
	const threshold = options.threshold ?? 0.3;
	const max = options.max ?? 24;

	await mkdir(join(outDir, "frames"), { recursive: true });

	const meta = await probe(video);
	const cuts = await detectCuts(video, threshold);

	// The hook starts at 0 and the scene filter never reports frame 0 as a change, so add it.
	const marks = [0, ...cuts].filter((t) => t < meta.durationSec);

	// Thin evenly when over the cap — too many frames drown the analysis.
	const step = Math.max(1, Math.ceil(marks.length / max));
	const picked = marks.filter((_, i) => i % step === 0);

	// Grab slightly AFTER the cut: landing exactly on it catches the middle of a fade or a
	// whip pan — a washed-out frame that says nothing about the shot.
	const SETTLE_SEC = 0.35;

	const frames: IngestFrame[] = [];
	for (const [i, t] of picked.entries()) {
		const at = Math.min(t + SETTLE_SEC, Math.max(0, meta.durationSec - 0.1));
		const file = join("frames", `${String(i).padStart(2, "0")}_${at.toFixed(2)}s.jpg`);
		await extractFrame(video, at, join(outDir, file));
		frames.push({ index: i, cutAtSec: Number(t.toFixed(2)), atSec: Number(at.toFixed(2)), file });
	}

	let audioFile: string | null = null;
	if (meta.hasAudio) {
		audioFile = "audio.wav";
		await extractAudio(video, join(outDir, audioFile));
	}

	const manifest: IngestManifest = {
		...meta,
		cutCount: cuts.length,
		avgShotSec: cuts.length ? Number((meta.durationSec / (cuts.length + 1)).toFixed(2)) : null,
		frames,
		audioFile,
	};
	await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, "\t"));

	return manifest;
}
