#!/usr/bin/env node
/**
 * Recorta um pedaço de uma gravação de tela (ou de um print) para usar como ELEMENTO.
 *
 * O mockup inteiro mostra o app; o recorte mostra UMA coisa do app — o número da dose, o card
 * da refeição, o gráfico — e entra nas cenas em que o celular não está em cena. É a inserção
 * que as referências fazem o tempo todo e que a gente não tinha como montar.
 *
 * Regra que não muda: recorte nunca vai por cima do mockup. A tela do app é a prova do
 * produto e não se cobre.
 *
 * Uso:
 *   # olhar a cara do vídeo antes de escolher o tempo e a área
 *   node tools/recorte.mjs amostra render/public/app/ozempro/calculadora.mp4
 *
 *   # recortar: --em em segundos, --area em % da origem (x,y,largura,altura)
 *   node tools/recorte.mjs cortar render/public/app/ozempro/calculadora.mp4 \
 *     --em 4.2 --area 8,18,84,26 --saida render/public/elementos/ozempro-dose-25ui.png
 *
 * Depois, no spec:
 *   { "type": "image", "src": "elementos/ozempro-dose-25ui.png",
 *     "x": 50, "y": 30, "width": 62, "radius": 24, "border": true, "label": "25 UI" }
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

function roda(cmd, lista) {
	const r = spawnSync(cmd, lista, { encoding: "utf8" });
	if (r.status !== 0) {
		console.error(`${cmd} falhou:\n${r.stderr || r.stdout}`);
		process.exit(1);
	}
	return (r.stdout || "").trim();
}

function dimensoes(arquivo) {
	const saida = roda("ffprobe", [
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height",
		"-of", "csv=p=0:s=x",
		arquivo,
	]);
	const [w, h] = saida.split("x").map(Number);
	return { w, h };
}

function duracao(arquivo) {
	const s = roda("ffprobe", [
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		arquivo,
	]);
	return Number(s) || 0;
}

/** Contact sheet rápido para escolher o instante e a área a recortar. */
function amostra(arquivo, destino) {
	const d = duracao(arquivo);
	const n = 6;
	const alvo = destino || resolve("render/out", `amostra-${Date.now()}.png`);
	mkdirSync(dirname(alvo), { recursive: true });
	// 6 quadros espalhados, com o tempo de cada um impresso no canto.
	const passo = d > 0 ? d / (n + 1) : 1;
	const tempos = Array.from({ length: n }, (_, i) => (i + 1) * passo);
	for (const [i, t] of tempos.entries()) {
		const tmp = resolve("render/out", `.amostra-${String(i)}.png`);
		roda("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", arquivo, "-frames:v", "1", tmp]);
	}
	// `tile` precisa de UMA sequência numerada, não de 6 entradas soltas.
	roda("ffmpeg", [
		"-y", "-loglevel", "error",
		"-start_number", "0",
		"-i", resolve("render/out", ".amostra-%d.png"),
		"-vf", "scale=380:-1,tile=3x2:margin=10:padding=10:color=#12091F",
		"-frames:v", "1",
		alvo,
	]);
	const { w, h } = dimensoes(arquivo);
	console.log(
		JSON.stringify(
			{
				amostra: alvo,
				duracaoSeg: Number(d.toFixed(2)),
				origem: `${w}x${h}`,
				quadros: tempos.map((t) => Number(t.toFixed(2))),
				dica: "escolha o tempo e rode: cortar <arquivo> --em <seg> --area x,y,larg,alt (em %)",
			},
			null,
			2,
		),
	);
}

function cortar(arquivo, o) {
	if (!o.saida) {
		console.error("Falta --saida (ex.: render/public/elementos/ozempro-dose.png)");
		process.exit(1);
	}
	const { w, h } = dimensoes(arquivo);
	// Área em % da origem; sem --area, a imagem inteira.
	const [ax, ay, aw, ah] = (o.area ? String(o.area).split(",").map(Number) : [0, 0, 100, 100]);
	if ([ax, ay, aw, ah].some((v) => !Number.isFinite(v))) {
		console.error("--area precisa ser x,y,largura,altura em % (ex.: 8,18,84,26)");
		process.exit(1);
	}
	// ffmpeg exige inteiros pares para alguns codecs; arredonda para baixo e garante mínimo 2.
	const cw = Math.max(2, Math.round((aw / 100) * w));
	const ch = Math.max(2, Math.round((ah / 100) * h));
	const cx = Math.min(w - cw, Math.max(0, Math.round((ax / 100) * w)));
	const cy = Math.min(h - ch, Math.max(0, Math.round((ay / 100) * h)));

	const saida = resolve(String(o.saida));
	mkdirSync(dirname(saida), { recursive: true });

	const base = ["-y", "-loglevel", "error"];
	const tempo = o.em !== undefined ? ["-ss", String(o.em)] : [];
	roda("ffmpeg", [
		...base,
		...tempo,
		"-i", arquivo,
		"-vf", `crop=${cw}:${ch}:${cx}:${cy}`,
		"-frames:v", "1",
		saida,
	]);

	console.log(
		JSON.stringify(
			{
				saida: String(o.saida),
				origem: `${w}x${h}`,
				recorte: `${cw}x${ch} em ${cx},${cy}`,
				em: o.em ?? 0,
				noSpec: {
					type: "image",
					src: String(o.saida).replace(/^render\/public\//, ""),
					x: 50,
					y: 30,
					width: 62,
					radius: 24,
					border: true,
				},
			},
			null,
			2,
		),
	);
}

const o = args(process.argv);
const [comando, arquivo] = o._;

if (!comando || !arquivo || !existsSync(arquivo)) {
	console.error(
		"Uso:\n" +
			"  node tools/recorte.mjs amostra <video ou imagem>\n" +
			"  node tools/recorte.mjs cortar <video ou imagem> --em <seg> --area x,y,larg,alt --saida <png>",
	);
	process.exit(1);
}

if (comando === "amostra") amostra(arquivo, o.saida);
else if (comando === "cortar") cortar(arquivo, o);
else {
	console.error(`Comando desconhecido: ${comando} (use "amostra" ou "cortar")`);
	process.exit(1);
}
