#!/usr/bin/env node
/**
 * Imagens do mascote com o modelo de imagem do Google AI Studio (Gemini).
 *
 * O ponto é consistência de personagem: manda-se a foto do panda como referência e pede-se
 * outra pose, outra expressão ou outro cenário. Sem referência, cada imagem sai com um panda
 * diferente — e aí a identidade da marca vai embora.
 *
 * Uso:
 *   node tools/img-gemini.mjs --ref entrada/ozempro/panda/poses/panda_gordinho.png \
 *     --prompt "o mesmo panda, enjoado, mão na barriga, fundo branco liso" \
 *     --out entrada/ozempro/panda/gerados/panda_enjoado.png
 *
 *   --ref aceita várias (até 5): --ref a.png --ref b.png
 *   --aspect 1:1 | 4:5 | 9:16 ...   --size 1K | 2K    --model <id>
 *
 * Chave: GEMINI_API_KEY no .env da raiz (a mesma da narração).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_PADRAO = "gemini-nano-banana-2.1";

function args(argv) {
	const out = { _: [], ref: [] };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const k = a.slice(2);
			const v = argv[i + 1]?.startsWith("--") ? true : argv[++i];
			if (k === "ref") out.ref.push(v);
			else out[k] = v ?? true;
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
	console.error('Falta GEMINI_API_KEY no .env da raiz: GEMINI_API_KEY="sua_chave"');
	process.exit(1);
}

const mime = (f) =>
	({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[
		extname(f).toLowerCase()
	] ?? "image/png";

function acharImagem(obj) {
	if (!obj || typeof obj !== "object") return null;
	for (const [k, v] of Object.entries(obj)) {
		if (typeof v === "string" && v.length > 5000 && /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200))) {
			if (/data|image|bytes|content/i.test(k)) return v;
		}
		if (typeof v === "object") {
			const r = acharImagem(v);
			if (r) return r;
		}
	}
	return null;
}

const a = args(process.argv);
const key = chave();
if (!a.prompt) {
	console.error('Falta --prompt "..."');
	process.exit(1);
}

const conteudo = [{ type: "text", text: a.prompt }];
for (const r of a.ref.slice(0, 5)) {
	const p = resolve(r);
	if (!existsSync(p)) {
		console.error(`Referência não encontrada: ${r}`);
		process.exit(1);
	}
	conteudo.push({ type: "image", mime_type: mime(p), data: readFileSync(p).toString("base64") });
}

const body = {
	model: a.model ?? MODEL_PADRAO,
	input: [{ type: "user_input", content: conteudo }],
	response_format: { type: "image", mime_type: a.jpeg === false ? "image/png" : "image/jpeg" },
	generation_config: {
		image_config: { aspect_ratio: a.aspect ?? "1:1", image_size: a.size ?? "1K" },
	},
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
const b64 = acharImagem(j);
if (!b64) {
	console.error("A resposta não trouxe imagem:\n" + JSON.stringify(j).slice(0, 800));
	process.exit(1);
}
const out = a.out ?? "entrada/ozempro/panda/gerados/panda.jpg";
mkdirSync(dirname(resolve(out)), { recursive: true });
const buf = Buffer.from(b64, "base64");
writeFileSync(resolve(out), buf);
console.log(JSON.stringify({ out, bytes: buf.length, refs: a.ref.length, modelo: body.model }, null, 2));
