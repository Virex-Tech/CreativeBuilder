#!/usr/bin/env node
/**
 * Narração com as vozes do Google AI Studio (Gemini TTS).
 *
 * A voz é a parte que mais denuncia um anúncio feito por IA, e a voz nativa do Higgsfield
 * saiu lenta e sem entonação. Aqui o estilo é instruído por texto ("rápida, animada"),
 * que é o que dá ritmo de UGC.
 *
 * Uso:
 *   node tools/tts-gemini.mjs --text "..." --out render/public/audio/<nome>.wav
 *   node tools/tts-gemini.mjs --file roteiro.txt --voice Kore --style "rápida e animada"
 *   node tools/tts-gemini.mjs --list-voices
 *
 * Chave: GEMINI_API_KEY no ambiente ou no .env da raiz (o .env não vai para o GitHub).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_PADRAO = "gemini-3.8-flash-tts";
const VOZ_PADRAO = "Achernar";
const ESTILO_PADRAO =
	"Promover. Fala muito rápida, animada e enérgica, como quem conta uma novidade urgente " +
	"para uma amiga; frases emendadas, sem pausa nenhuma entre elas, entonação forte";

function args(argv) {
	const out = { _: [] };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const k = a.slice(2);
			const v = argv[i + 1]?.startsWith("--") ? true : argv[++i];
			out[k] = v ?? true;
		} else out._.push(a);
	}
	return out;
}

function chave() {
	if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
	const env = resolve(".env");
	if (existsSync(env)) {
		const m = readFileSync(env, "utf8").match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
		if (m) return m[1].trim().replace(/^["']|["']$/g, "");
	}
	console.error(
		"Falta a chave. Crie em https://aistudio.google.com/apikey e coloque no .env da raiz:\n" +
			'  GEMINI_API_KEY="sua_chave"',
	);
	process.exit(1);
}

async function listarVozes(key) {
	const r = await fetch(`${API}/voices`, { headers: { "x-goog-api-key": key } });
	if (!r.ok) {
		console.error(`Erro ${r.status}: ${await r.text()}`);
		process.exit(1);
	}
	const j = await r.json();
	const vozes = j.voices ?? j.data ?? [];
	const nome = (v) => {
		const n = v.name ?? v.voice ?? v.voiceName ?? v;
		if (typeof n === "string") return n.split("/").pop();
		return n?.name ?? n?.id ?? JSON.stringify(n);
	};
	for (const v of vozes) console.log(`${nome(v)}  ${v.description ?? ""}`.trim());
	console.log(`\n${vozes.length} vozes.`);
}

async function gerar({ key, texto, voz, estilo, modelo, out }) {
	const body = {
		model: modelo,
		input: [
			{
				type: "user_input",
				content: [
					{
						type: "text",
						text: texto,
						annotations: [{ type: "speech_metadata", style: estilo }],
					},
				],
			},
		],
		response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
		generation_config: { speech_config: [{ voice: voz }] },
	};

	const r = await fetch(`${API}/interactions`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-goog-api-key": key },
		body: JSON.stringify(body),
	});
	if (!r.ok) {
		console.error(`Erro ${r.status}: ${(await r.text()).slice(0, 800)}`);
		process.exit(1);
	}
	const j = await r.json();

	// O áudio vem em base64 em algum campo da resposta; procura o primeiro que pareça áudio.
	const b64 = acharAudio(j);
	if (!b64) {
		console.error("A resposta não trouxe áudio. Resposta crua:\n" + JSON.stringify(j).slice(0, 800));
		process.exit(1);
	}
	mkdirSync(dirname(resolve(out)), { recursive: true });
	const buf = Buffer.from(b64, "base64");
	writeFileSync(resolve(out), buf);

	// Pausa e respiração matam o ritmo de UGC. O modelo ainda deixa espaços entre as frases,
	// então o corte é feito aqui, sempre — é o que diferencia "lido" de "falado rápido".
	const antes = duracao(out);
	semPausas(out);
	const depois = duracao(out);
	console.log(
		JSON.stringify(
			{ out, bytes: buf.length, voz, modelo, segundos: depois, cortadoDePausas: +(antes - depois).toFixed(2) },
			null,
			2,
		),
	);
}

function duracao(arquivo) {
	const r = spawnSync(
		"ffprobe",
		["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", resolve(arquivo)],
		{ encoding: "utf8" },
	);
	return Number.parseFloat(r.stdout.trim()) || 0;
}

/** Corta todo silêncio interno (inclusive respiração) e deixa 60ms de folga nas pontas. */
function semPausas(arquivo) {
	const a = resolve(arquivo);
	const tmp = a.replace(/\.wav$/i, ".tmp.wav");
	const r = spawnSync(
		"ffmpeg",
		[
			"-v", "error", "-y", "-i", a,
			"-af",
			"silenceremove=start_periods=1:start_duration=0:start_threshold=-40dB:" +
				"stop_periods=-1:stop_duration=0.12:stop_threshold=-38dB:detection=peak,apad=pad_dur=0.06",
			tmp,
		],
		{ encoding: "utf8" },
	);
	if (r.status === 0 && existsSync(tmp)) {
		writeFileSync(a, readFileSync(tmp));
		spawnSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "del", tmp] : [tmp]);
	} else {
		console.error("Aviso: não consegui cortar as pausas (ffmpeg).", r.stderr?.slice(0, 200) ?? "");
	}
}

function acharAudio(obj) {
	if (!obj || typeof obj !== "object") return null;
	for (const [k, v] of Object.entries(obj)) {
		if (typeof v === "string" && v.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200))) {
			if (/audio|data|content|bytes/i.test(k)) return v;
		}
		if (typeof v === "object") {
			const r = acharAudio(v);
			if (r) return r;
		}
	}
	return null;
}

const a = args(process.argv);
const key = chave();
if (a["list-voices"]) {
	await listarVozes(key);
} else {
	const texto = a.file ? readFileSync(resolve(a.file), "utf8").trim() : a.text;
	if (!texto) {
		console.error('Falta o texto. Use --text "..." ou --file roteiro.txt');
		process.exit(1);
	}
	await gerar({
		key,
		texto,
		voz: a.voice ?? VOZ_PADRAO,
		estilo: a.style ?? ESTILO_PADRAO,
		modelo: a.model ?? MODEL_PADRAO,
		out: a.out ?? "render/public/audio/narracao.wav",
	});
}
