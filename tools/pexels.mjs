#!/usr/bin/env node
/**
 * Busca e baixa foto/vídeo do Pexels (licença livre para uso comercial).
 *
 * Serve para b-roll genérico — cozinha, academia, mão segurando celular — sem gastar crédito
 * de IA. Material do app, do panda e de pessoas reais continua vindo das pastas da equipe.
 *
 * Uso:
 *   node tools/pexels.mjs buscar video "mulher cozinha manhã" --n 5
 *   node tools/pexels.mjs baixar video 123456 --out entrada/ozempro/broll/cozinha.mp4
 *   node tools/pexels.mjs buscar foto "seringa mesa" --n 8 --orientacao portrait
 *
 * Chave: PEXELS_API_KEY no .env da raiz (grátis em https://www.pexels.com/api/).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function chave() {
	if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
	const env = resolve(".env");
	if (existsSync(env)) {
		const m = readFileSync(env, "utf8").match(/^\s*PEXELS_API_KEY\s*=\s*(.+)\s*$/m);
		if (m) return m[1].trim().replace(/^["']|["']$/g, "");
	}
	console.error(
		'Falta a chave. Crie em https://www.pexels.com/api/ e ponha no .env: PEXELS_API_KEY="sua_chave"',
	);
	process.exit(1);
}

function args(argv) {
	const out = { _: [] };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
		else out._.push(a);
	}
	return out;
}

const a = args(process.argv);
const [comando, tipo, termo] = a._;
const key = chave();
const headers = { Authorization: key };

/** Maior arquivo abaixo do limite — o Pexels devolve do 4K ao 360p. */
function melhorVideo(v, maxLargura = 1920) {
	const ok = v.video_files
		.filter((f) => f.width && f.width <= maxLargura)
		.sort((x, y) => y.width - x.width);
	return ok[0] ?? v.video_files[0];
}

async function buscar() {
	const n = Number(a.n ?? 6);
	const orient = a.orientacao ?? "portrait";
	const url =
		tipo === "video"
			? `https://api.pexels.com/videos/search?query=${encodeURIComponent(termo)}&per_page=${n}&orientation=${orient}`
			: `https://api.pexels.com/v1/search?query=${encodeURIComponent(termo)}&per_page=${n}&orientation=${orient}`;

	const r = await fetch(url, { headers });
	if (!r.ok) {
		console.error(`Erro ${r.status}: ${(await r.text()).slice(0, 300)}`);
		process.exit(1);
	}
	const j = await r.json();
	const itens = (j.videos ?? j.photos ?? []).map((it) => {
		if (tipo === "video") {
			const f = melhorVideo(it);
			return {
				id: it.id,
				duracao: `${it.duration}s`,
				tamanho: `${f.width}x${f.height}`,
				autor: it.user?.name,
				preview: it.image,
				pagina: it.url,
			};
		}
		return {
			id: it.id,
			tamanho: `${it.width}x${it.height}`,
			autor: it.photographer,
			descricao: it.alt,
			pagina: it.url,
		};
	});
	console.log(JSON.stringify({ total: j.total_results, itens }, null, 2));
}

async function baixar() {
	const id = termo;
	const url =
		tipo === "video" ? `https://api.pexels.com/videos/videos/${id}` : `https://api.pexels.com/v1/photos/${id}`;
	const r = await fetch(url, { headers });
	if (!r.ok) {
		console.error(`Erro ${r.status}: ${(await r.text()).slice(0, 300)}`);
		process.exit(1);
	}
	const it = await r.json();
	const link = tipo === "video" ? melhorVideo(it).link : (it.src?.original ?? it.src?.large2x);
	const destino = a.out ?? `entrada/pexels/${tipo}-${id}.${tipo === "video" ? "mp4" : "jpg"}`;

	const bin = await fetch(link);
	const buf = Buffer.from(await bin.arrayBuffer());
	mkdirSync(dirname(resolve(destino)), { recursive: true });
	writeFileSync(resolve(destino), buf);
	console.log(
		JSON.stringify(
			{
				out: destino,
				mb: +(buf.length / 1024 / 1024).toFixed(1),
				autor: it.user?.name ?? it.photographer,
				pagina: it.url,
			},
			null,
			2,
		),
	);
}

if (comando === "buscar" && tipo && termo) await buscar();
else if (comando === "baixar" && tipo && termo) await baixar();
else {
	console.error(
		'Uso:\n  node tools/pexels.mjs buscar video "termo" [--n 6] [--orientacao portrait]\n' +
			'  node tools/pexels.mjs baixar video <id> --out caminho.mp4',
	);
	process.exit(1);
}
