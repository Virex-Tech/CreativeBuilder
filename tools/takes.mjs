#!/usr/bin/env node
/**
 * Takes gravados (UGC) no fluxo local — o mesmo que o worker da plataforma faz com cada take.
 *
 *   node tools/takes.mjs preparar <arquivo|pasta|link>... [--lang pt] [--modelo small]
 *   node tools/takes.mjs listar
 *
 * `preparar` deixa cada take pronto para a camada `footage` do spec:
 *   render/public/takes/<nome>.mp4         H.264/AAC 30fps até 1080×1920 (o Remotion lê sem surpresa;
 *                                          vídeo HEVC/HDR de iPhone não abre no Chrome do render)
 *   render/public/takes/<nome>.words.json  transcrição com o tempo de cada palavra (faster-whisper)
 *   render/public/takes/<nome>/f1.jpg f2.jpg  dois frames para você OLHAR (Read) antes de editar
 * e imprime a fala no formato "[início–fim] palavra@segundo ..." — é por ela que se escolhe onde
 * cortar. Depois de escrever o spec, rode `node tools/spec-tool.mjs footage <spec>`: ele puxa os
 * cortes pra fronteira de palavra e gera a legenda da fala real (igual à plataforma).
 *
 * Link: Google Drive (arquivo compartilhado), Instagram/TikTok/YouTube (yt-dlp) ou arquivo direto.
 */

import { execFile } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const TAKES = resolve("render", "public", "takes");
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i;

const slug = (s) =>
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60) || "take";

async function python() {
	for (const bin of process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]) {
		try {
			await run(bin, ["--version"]);

			return bin;
		} catch {
			// tenta o próximo
		}
	}
	throw new Error("Python não encontrado — rode node tools/doctor.mjs");
}

async function probe(file) {
	const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file]);
	const d = JSON.parse(stdout);
	const v = d.streams.find((s) => s.codec_type === "video");

	return { durationMs: Math.round(Number(d.format.duration) * 1000), width: v?.width ?? null, height: v?.height ?? null, hasAudio: d.streams.some((s) => s.codec_type === "audio") };
}

async function download(url, dest) {
	const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([\w-]{20,})/);
	if (drive || !/instagram|tiktok|youtu|facebook|fb\.watch|x\.com|twitter/i.test(url)) {
		const res = await fetch(drive ? `https://drive.usercontent.google.com/download?id=${drive[1]}&export=download&confirm=t` : url, { redirect: "follow" });
		const type = res.headers.get("content-type") ?? "";
		if (res.ok && res.body && !type.includes("text/html")) {
			await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));

			return;
		}
		if (drive) throw new Error('o Drive abriu uma página, não o vídeo — o arquivo está como "qualquer pessoa com o link"?');
	}
	await run("yt-dlp", ["--no-playlist", "--quiet", "--no-warnings", "-f", "bv*+ba/b", "--merge-output-format", "mp4", "-o", dest, url], { maxBuffer: 16 << 20 });
}

/** Mesma conversão da plataforma (server/src/lib/takes.ts). */
async function normalize(input, output, hasAudio) {
	await run(
		"ffmpeg",
		[
			"-y", "-i", input,
			"-vf", "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30,format=yuv420p",
			"-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
			...(hasAudio ? ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]),
			"-movflags", "+faststart",
			output,
		],
		{ maxBuffer: 64 << 20 },
	);
}

/** Mesmo formato que a IA da plataforma recebe: frases quebradas nas pausas, início de cada palavra. */
function speech(words) {
	if (!words.length) return "    (sem fala)";
	const s = (ms) => (ms / 1000).toFixed(2);
	const lines = [];
	let cur = [];
	const flush = () => {
		if (cur.length) lines.push(`    [${s(cur[0].startMs)}–${s(cur.at(-1).endMs)}] ${cur.map((w) => `${w.word}@${s(w.startMs)}`).join(" ")}`);
		cur = [];
	};
	for (const [i, w] of words.entries()) {
		if (i > 0 && w.startMs - words[i - 1].endMs > 450) flush();
		cur.push(w);
	}
	flush();

	return lines.join("\n");
}

async function inputs(args) {
	const out = [];
	for (const a of args) {
		if (/^https?:\/\//i.test(a)) {
			out.push({ url: a });
			continue;
		}
		const p = resolve(a);
		if (!existsSync(p)) throw new Error(`não achei: ${a}`);
		if ((await stat(p)).isDirectory()) {
			for (const f of (await readdir(p)).sort()) if (VIDEO.test(f)) out.push({ file: join(p, f) });
		} else out.push({ file: p });
	}

	return out;
}

async function preparar(args, flags) {
	const list = await inputs(args);
	if (!list.length) throw new Error("uso: node tools/takes.mjs preparar <arquivo|pasta|link>... [--lang pt] [--modelo small]");
	await mkdir(TAKES, { recursive: true });
	const py = await python();

	for (const [i, item] of list.entries()) {
		let src = item.file;
		let temp = null;
		const base = item.file ? basename(item.file, extname(item.file)) : `link-${Date.now()}-${i}`;
		let name = slug(base);
		while (existsSync(join(TAKES, `${name}.mp4`)) && !flags.substituir) name = `${slug(base)}-${Math.random().toString(36).slice(2, 6)}`;
		console.error(`→ ${item.file ?? item.url}`);
		try {
			if (item.url) {
				temp = join(TAKES, `.${name}.download`);
				await download(item.url, temp);
				src = temp;
			}
			const info = await probe(src);
			const mp4 = join(TAKES, `${name}.mp4`);
			await normalize(src, mp4, info.hasAudio);
			const norm = await probe(mp4);

			await mkdir(join(TAKES, name), { recursive: true });
			for (const [f, at] of [["f1.jpg", 0.25], ["f2.jpg", 0.7]]) {
				await run("ffmpeg", ["-y", "-ss", ((norm.durationMs / 1000) * at).toFixed(2), "-i", mp4, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", join(TAKES, name, f)]);
			}

			let words = [];
			if (norm.hasAudio) {
				const out = join(TAKES, `${name}.words.json`);
				const t = [join("tools", "transcribe.py"), mp4, "--out", out, "--model", flags.modelo ?? "small"];
				if (flags.lang) t.push("--lang", flags.lang);
				await run(py, t, { maxBuffer: 16 << 20 });
				words = JSON.parse(await readFile(out, "utf8")).words ?? [];
			}

			console.log(`\ntake "${name}" · ${(norm.durationMs / 1000).toFixed(2)}s · ${norm.width}×${norm.height}`);
			console.log(`  layer: { "type": "footage", "takeId": "${name}", "src": "takes/${name}.mp4", "startFromMs": 0 }`);
			console.log(`  frames: render/public/takes/${name}/f1.jpg, f2.jpg`);
			console.log(`  fala:\n${speech(words)}`);
		} catch (err) {
			console.log(`\nFALHOU ${item.file ?? item.url}: ${err.stderr?.trim().split("\n").pop() || err.message}`);
		} finally {
			if (temp) await rm(temp, { force: true });
		}
	}
}

async function listar() {
	if (!existsSync(TAKES)) return console.log("nenhum take preparado (render/public/takes/ vazio)");
	for (const f of (await readdir(TAKES)).filter((f) => f.endsWith(".mp4")).sort()) {
		const name = f.replace(/\.mp4$/, "");
		const info = await probe(join(TAKES, f));
		const wf = join(TAKES, `${name}.words.json`);
		const words = existsSync(wf) ? JSON.parse(await readFile(wf, "utf8")).words ?? [] : [];
		console.log(`\ntake "${name}" · ${(info.durationMs / 1000).toFixed(2)}s · src "takes/${f}"\n  fala:\n${speech(words)}`);
	}
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
	if (rest[i].startsWith("--")) {
		const k = rest[i].slice(2);
		flags[k] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
	} else args.push(rest[i]);
}

const commands = { preparar: () => preparar(args, flags), listar };
if (!commands[cmd]) {
	console.error("comandos: preparar <arquivo|pasta|link>... [--lang pt] [--modelo small] | listar");
	process.exit(1);
}
commands[cmd]().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
