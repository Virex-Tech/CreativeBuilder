import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import type { Take } from "@prisma/client";

import { assetsDir } from "@/lib/assets";
import { env } from "@/lib/env";
import { downloadVideo } from "@/lib/fetchVideo";
import { probe } from "@/lib/ingest";
import { prisma } from "@/lib/prisma";

/**
 * Takes: os vídeos gravados (ou gerados) que a IA edita.
 *
 * Chegue por onde chegar (upload, link, Drive, link de envio, kie.ai), todo take passa pelo
 * mesmo caminho no worker: baixa (se veio por link) → normaliza pra um MP4 que o Remotion lê
 * sem surpresa (H.264/AAC, 30fps, no máximo 1080×1920, faststart) → miniatura + 2 frames pra
 * IA ver → transcrição com o tempo de cada palavra. É pela transcrição que a IA escolhe onde
 * cortar e que o servidor monta a legenda.
 */

const run = promisify(execFile);

export interface Word {
	word: string;
	startMs: number;
	endMs: number;
}

export interface Transcript {
	language?: string;
	text: string;
	words: Word[];
}

export const takesDir = (): string => join(env.STORAGE_DIR, "takes");
/** Frames que a IA olha (não servidos): takes/<id>/f1.jpg, f2.jpg. */
export const takeFramesDir = (id: string): string => join(takesDir(), id);

export function publicAssetUrl(file: string | null | undefined): string | null {
	if (!file) return null;

	return env.PUBLIC_API_BASE ? `${env.PUBLIC_API_BASE.replace(/\/$/, "")}/assets/${file}` : `/assets/${file}`;
}

/** Link do Drive de um arquivo → download direto (funciona sem chave pra arquivo público). */
export function driveFileId(url: string): string | null {
	const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([\w-]{20,})/);

	return m?.[1] ?? null;
}

export const driveDownloadUrl = (id: string): string =>
	`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

/** Download HTTP puro (Drive, kie.ai, links diretos) — sem checar content-type. */
async function plainDownload(url: string, dest: string): Promise<void> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) throw new Error(`download falhou (HTTP ${res.status})`);
	const type = res.headers.get("content-type") ?? "";
	// O Drive devolve uma página HTML quando o arquivo não é público.
	if (type.includes("text/html")) throw new Error("o link abriu uma página, não o vídeo — o arquivo está compartilhado com \"qualquer pessoa com o link\"?");
	await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
}

async function fetchRaw(take: Take): Promise<string> {
	if (take.rawPath) return take.rawPath;
	if (!take.sourceUrl) throw new Error("take sem arquivo nem link");
	await mkdir(takesDir(), { recursive: true });
	const dest = join(takesDir(), `${take.id}.src`);
	const driveId = driveFileId(take.sourceUrl);
	if (take.source === "DRIVE" || take.source === "KIE" || driveId) {
		await plainDownload(driveId ? driveDownloadUrl(driveId) : take.sourceUrl, dest);
	} else {
		// Link social (Instagram/TikTok/YouTube) ou arquivo direto: o yt-dlp resolve os dois.
		await downloadVideo(take.sourceUrl, dest);
	}

	return dest;
}

/** H.264/AAC 30fps dentro de 1080×1920, orientação já aplicada (o ffmpeg gira pelo metadado). */
async function normalize(input: string, output: string, hasAudio: boolean): Promise<void> {
	await run(
		"ffmpeg",
		[
			"-y",
			"-i", input,
			"-vf",
			"scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30,format=yuv420p",
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-crf", "20",
			...(hasAudio ? ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]),
			"-movflags", "+faststart",
			output,
		],
		{ maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 },
	);
}

async function frame(input: string, atSec: number, output: string, width: number): Promise<void> {
	await run("ffmpeg", ["-y", "-ss", atSec.toFixed(2), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", output]);
}

/**
 * Uma transcrição por vez no processo: cada whisper carrega o modelo (~0,5–1 GB de RAM) e a
 * VPS divide memória com o render. Takes e referências entram na mesma fila.
 */
let whisperQueue: Promise<unknown> = Promise.resolve();

export function transcribe(media: string): Promise<Transcript> {
	const next = whisperQueue.then(() => runWhisper(media));
	whisperQueue = next.catch(() => undefined);

	return next;
}

/** Transcreve com faster-whisper (py/transcribe.py). Lento na 1ª vez: baixa o modelo. */
async function runWhisper(media: string): Promise<Transcript> {
	const out = `${media}.words.json`;
	const script = join(__dirname, "..", "..", "py", "transcribe.py");
	const args = [script, media, "--out", out, "--model", env.WHISPER_MODEL, "--threads", String(env.WHISPER_THREADS)];
	if (env.WHISPER_LANG) args.push("--lang", env.WHISPER_LANG);
	try {
		await run("python3", args, { maxBuffer: 16 * 1024 * 1024, timeout: 20 * 60 * 1000 });
	} catch (err) {
		const stderr = (err as { stderr?: string }).stderr ?? "";
		throw new Error(stderr.trim().split("\n").pop() || "transcrição falhou");
	}
	const parsed = JSON.parse(await readFile(out, "utf8")) as Transcript;
	await rm(out, { force: true });

	return { language: parsed.language, text: parsed.text, words: parsed.words };
}

/** Processa um take QUEUED de ponta a ponta. Chamado pelo worker, um por vez. */
export async function processTake(take: Take): Promise<void> {
	const raw = await fetchRaw(take);
	if (!take.rawPath) await prisma.take.update({ where: { id: take.id }, data: { rawPath: raw } });

	const info = await probe(raw);
	if (!info.width || !Number.isFinite(info.durationSec)) throw new Error("o arquivo não parece ser um vídeo");

	await mkdir(assetsDir(), { recursive: true });
	const file = `${take.id}.mp4`;
	const thumbFile = `${take.id}.jpg`;
	const video = join(assetsDir(), file);
	await normalize(raw, video, info.hasAudio);

	const normalized = await probe(video);
	const durationSec = normalized.durationSec;
	await frame(video, Math.min(0.5, durationSec / 2), join(assetsDir(), thumbFile), 360);
	await mkdir(takeFramesDir(take.id), { recursive: true });
	await frame(video, durationSec * 0.25, join(takeFramesDir(take.id), "f1.jpg"), 360);
	await frame(video, durationSec * 0.7, join(takeFramesDir(take.id), "f2.jpg"), 360);

	await prisma.take.update({
		where: { id: take.id },
		data: {
			file,
			thumbFile,
			durationMs: Math.round(durationSec * 1000),
			width: normalized.width,
			height: normalized.height,
			hasAudio: normalized.hasAudio,
		},
	});

	const transcript = normalized.hasAudio ? await transcribe(video) : { text: "", words: [] };
	await prisma.take.update({
		where: { id: take.id },
		data: { transcript: transcript as object, status: "DONE", error: null },
	});

	// O original só servia pra normalizar; o que fica é o MP4 normalizado.
	if (raw.startsWith(takesDir())) await rm(raw, { force: true });
}

/** Tamanho do arquivo (pra recusar upload vazio). */
export async function fileSize(path: string): Promise<number> {
	try {
		return (await stat(path)).size;
	} catch {
		return 0;
	}
}
