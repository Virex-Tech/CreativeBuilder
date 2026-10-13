import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Downloads a reference video from a URL into `destMp4`.
 *
 * Two kinds of link have to work: a direct file (a signed S3/CDN URL ending in .mp4) and a
 * social post (Instagram / TikTok / YouTube). yt-dlp handles both — for a social link it
 * resolves the real media, for a direct one it just fetches — so we try it first and fall
 * back to a plain HTTP download only if yt-dlp is unavailable or refuses the URL.
 */
export async function downloadVideo(sourceUrl: string, destMp4: string): Promise<void> {
	try {
		await run(
			"yt-dlp",
			[
				"--no-playlist",
				"--quiet",
				"--no-warnings",
				// Prefer an mp4 that Remotion and ffmpeg both read without a remux.
				"-f", "bv*+ba/b",
				"--merge-output-format", "mp4",
				"-o", destMp4,
				sourceUrl,
			],
			{ maxBuffer: 16 * 1024 * 1024, timeout: 5 * 60 * 1000 },
		);

		return;
	} catch (err) {
		// A social URL that yt-dlp genuinely can't resolve is a real failure; but a plain
		// direct link on a box without yt-dlp is not, so try a raw download before giving up.
		await rm(destMp4, { force: true });
		const ok = await directDownload(sourceUrl, destMp4);
		if (!ok) {
			throw new Error(
				`não consegui baixar o vídeo do link (${err instanceof Error ? err.message.split("\n")[0] : "erro"})`,
			);
		}
	}
}

async function directDownload(sourceUrl: string, destMp4: string): Promise<boolean> {
	let res: Response;
	try {
		res = await fetch(sourceUrl, { redirect: "follow" });
	} catch {
		return false;
	}
	const type = res.headers.get("content-type") ?? "";
	// Only accept it if it actually looks like a video file — an HTML page (a social post
	// yt-dlp already declined) would otherwise be saved as a broken ".mp4".
	if (!res.ok || !res.body || !(type.startsWith("video/") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(sourceUrl))) {
		return false;
	}

	await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(destMp4));

	return true;
}
