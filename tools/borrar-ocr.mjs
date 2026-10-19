#!/usr/bin/env node
/**
 * Borra o nome dos medicamentos QUADRO A QUADRO, lendo a tela com OCR.
 *
 * Em cada quadro: lê o texto, acha onde está escrito um nome de medicamento, borra exatamente
 * ali. No quadro seguinte lê de novo. Não há interpolação, não há rastreamento, não há faixa
 * medida à mão — por isso o borrão acompanha a rolagem sozinho e some quando o nome sai da tela.
 *
 * (A tentativa anterior — medir a posição em alguns pontos e interpolar — falhou três vezes:
 * a tela não só rola, ela muda. Ver AGENTS.md.)
 *
 * Uso:
 *   node tools/borrar-ocr.mjs <video> --saida <out.mp4> [--idioma fra] [--escala 0.5]
 *   node tools/borrar-ocr.mjs <video> --saida <out.mp4> --nomes "mounjaro,ozempic,zep"
 *   node tools/borrar-ocr.mjs <video> --so-ler        # não grava vídeo, só relata o que achou
 *
 * O OCR roda na máquina (tesseract.js). Não usa API, não gasta crédito.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createWorker } from "tesseract.js";

/** Marcas e princípios ativos de GLP-1. Fragmento basta: a caixa é expandida com margem. */
const NOMES_PADRAO = [
	"mounjaro", "ozempic", "wegovy", "zepbound", "zep", "lié", "lie", "oziv", "ozivy", "saxenda",
	"trulicity", "victoza", "rybelsus", "tirzepatida", "tirzepatide", "semaglutida",
	"semaglutide", "liraglutida", "liraglutide", "dulaglutida", "olire", "mysimba",
];

/**
 * Distância de edição — quantas letras mudar para ir de a até b.
 *
 * O OCR erra letra em texto de baixo contraste: "Mounjaro" vira "Mouniaro", "Mounjara",
 * "Mouniara". Comparar letra a letra deixaria o nome passar, e pior: a palavra errada vira
 * "palavra inocente" e empurra o borrão para o lado, que foi o vazamento de 16/10/2026.
 */
function distancia(a, b) {
	const m = a.length, n = b.length;
	if (!m || !n) return Math.max(m, n);
	let ant = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) {
			cur[j] = Math.min(
				ant[j] + 1,
				cur[j - 1] + 1,
				ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		ant = cur;
	}
	return ant[n];
}

/**
 * A palavra é um nome de medicamento?
 *
 * Palavra INTEIRA. Fragmento não vale: "lie" (de Lié) dentro de "caliente" e de "applied"
 * fazia a ferramenta borrar palavra inocente (18/10/2026). A única folga é erro de leitura —
 * em texto de baixo contraste o OCR troca letra ("Mounjaro" → "Mouniaro") — e ela só vale para
 * nome de 7 letras ou mais, senão "Olire" aceitaria "Olive" de uma receita.
 *
 * Palavra incompleta (chip cortado pela margem) não é identificada, e então não é borrada.
 */
function ehNome(texto, alvos) {
	const t = texto.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
	if (!t) return false;
	for (const alvo of alvos) {
		if (t === alvo) return true;
		if (alvo.length >= 7 && Math.abs(t.length - alvo.length) <= 2) {
			if (distancia(t, alvo) <= Math.max(1, Math.floor(alvo.length / 5))) return true;
		}
	}
	return false;
}

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

function roda(cmd, lista, opts = {}) {
	const r = spawnSync(cmd, lista, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
	if (r.status !== 0) {
		console.error(`${cmd} falhou:\n${(r.stderr || r.stdout || "").slice(-1500)}`);
		process.exit(1);
	}
	return (r.stdout || "").trim();
}

function infoVideo(arquivo) {
	const s = roda("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
		"stream=width,height,r_frame_rate", "-of", "csv=p=0", arquivo]);
	const [w, h, taxa] = s.split(",");
	const [num, den] = taxa.split("/").map(Number);
	return { W: Number(w), H: Number(h), fps: num / (den || 1) };
}

/** Junta caixas que se encostam, para um nome partido em duas palavras virar um borrão só. */
function unir(caixas, folga) {
	const fora = [];
	for (const c of caixas.sort((a, b) => a.y - b.y || a.x - b.x)) {
		const j = fora.find(
			(o) => Math.abs(o.y - c.y) < folga && c.x <= o.x + o.w + folga && c.x + c.w >= o.x - folga,
		);
		if (j) {
			const x1 = Math.min(j.x, c.x), y1 = Math.min(j.y, c.y);
			const x2 = Math.max(j.x + j.w, c.x + c.w), y2 = Math.max(j.y + j.h, c.y + c.h);
			j.x = x1; j.y = y1; j.w = x2 - x1; j.h = y2 - y1;
		} else fora.push({ ...c });
	}
	return fora;
}

/** Borrão de caixa, duas passadas (horizontal e vertical) — aproxima gaussiana e é rápido. */
function borraRegiao(buf, W, H, cx, cy, cw, ch, raio) {
	const x0 = Math.max(0, cx), y0 = Math.max(0, cy);
	const x1 = Math.min(W, cx + cw), y1 = Math.min(H, cy + ch);
	if (x1 <= x0 || y1 <= y0) return;
	const larg = x1 - x0, alt = y1 - y0;
	const tmp = Buffer.allocUnsafe(larg * alt * 3);

	for (let y = 0; y < alt; y++) {
		for (let x = 0; x < larg; x++) {
			let r = 0, g = 0, b = 0, n = 0;
			for (let k = -raio; k <= raio; k++) {
				const xx = Math.min(larg - 1, Math.max(0, x + k));
				const p = ((y0 + y) * W + (x0 + xx)) * 3;
				r += buf[p]; g += buf[p + 1]; b += buf[p + 2]; n++;
			}
			const q = (y * larg + x) * 3;
			tmp[q] = r / n; tmp[q + 1] = g / n; tmp[q + 2] = b / n;
		}
	}
	for (let y = 0; y < alt; y++) {
		for (let x = 0; x < larg; x++) {
			let r = 0, g = 0, b = 0, n = 0;
			for (let k = -raio; k <= raio; k++) {
				const yy = Math.min(alt - 1, Math.max(0, y + k));
				const q = (yy * larg + x) * 3;
				r += tmp[q]; g += tmp[q + 1]; b += tmp[q + 2]; n++;
			}
			const p = ((y0 + y) * W + (x0 + x)) * 3;
			buf[p] = r / n; buf[p + 1] = g / n; buf[p + 2] = b / n;
		}
	}
}

/**
 * Nomes na mesma linha viram um borrão só, do primeiro ao último.
 *
 * A linha de chips tem um selecionado (texto branco em fundo preto) que o OCR às vezes não lê.
 * Cobrindo o vão entre os nomes lidos, ele entra junto.
 */
function porLinha(caixas) {
	const linhas = [];
	for (const c of caixas) {
		const l = linhas.find((o) => Math.abs((o.y + o.h / 2) - (c.y + c.h / 2)) < c.h * 0.7);
		if (l) {
			const x1 = Math.min(l.x, c.x), y1 = Math.min(l.y, c.y);
			const x2 = Math.max(l.x + l.w, c.x + c.w), y2 = Math.max(l.y + l.h, c.y + c.h);
			l.x = x1; l.y = y1; l.w = x2 - x1; l.h = y2 - y1;
			l.texto += "+" + c.texto;
		} else linhas.push({ ...c });
	}
	return linhas;
}

const o = args(process.argv);
const arquivo = o._[0];
if (!arquivo || !existsSync(arquivo)) {
	console.error("Uso: node tools/borrar-ocr.mjs <video> --saida <out.mp4> [--idioma fra] [--escala 0.5]");
	process.exit(1);
}

const { W, H, fps } = infoVideo(arquivo);
const escala = Number(o.escala ?? 1);             // resolução cheia: medido, acerta 20/20
const idioma = String(o.idioma ?? "por+fra+eng");
const alvos = String(o.nomes ?? NOMES_PADRAO.join(",")).toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const margemX = Number(o.margemx ?? 14);          // folga em px (no quadro cheio)
const margemY = Number(o.margemy ?? 10);
const raio = Number(o.raio ?? 10);

const tmp = mkdtempSync(join(tmpdir(), "borrar-ocr-"));

// ACHATAR O BRILHO antes de ler. O Tesseract converte a imagem para preto e branco usando um
// único corte de brilho, e essa decisão acontece ANTES de tentar reconhecer letra. Num quadro
// com modal branco por cima e o resto escurecido, o branco domina o corte e toda a camada de
// baixo vira "fundo": o nome fica legível para o olho e invisível para o OCR.
//
// Dividir o quadro por uma cópia bem borrada dele mesmo remove qualquer variação suave de
// iluminação — o escurecimento do modal, o fundo colorido de um chip — e deixa só o desenho das
// letras. Medido em 16/10/2026, no quadro 45 da aplicação em inglês: 6 palavras lidas no quadro
// cru contra 50 no achatado, e o nome escurecido só aparece no achatado.
const ACHATA = "[0:v]format=gray,split=2[a][b];[b]gblur=sigma=60[bg];" +
	"[a][bg]blend=all_mode=divide,eq=contrast=1.6:brightness=-0.25";

// TRÊS LEITURAS POR QUADRO, e a palavra lida em qualquer uma delas conta.
//
// O Tesseract só lê texto ESCURO em fundo claro, e decide o corte de preto-e-branco sozinho,
// uma vez para a tela inteira. Isso faz ele perder chip de baixo contraste e chip colorido.
// Entregando a imagem já binarizada, o corte passa a ser nosso; invertendo, o texto claro em
// fundo escuro vira escuro em fundo claro.
//
// Um jeito só não serve. Medido no estoque em turco, 18/10/2026 (os três chips na tela):
//
//   quadro  48: corte 100 invertido → Mounjaro   | corte 190 → Ozempic, Ozivy
//   quadro 164: corte 100 invertido → Mounjaro   | cinza invertido → Ozempic, Ozivy
//
// Nenhuma leitura sozinha achou os três em nenhum dos dois quadros; as três juntas acham.
// Fatiar o quadro e ampliar 2x foram testados e não acrescentam nada.
const LEITURAS = [
	{ nome: "c100i", filtro: `${ACHATA},lut=y='if(gt(val,100),255,0)',negate` },
	{ nome: "c190", filtro: `${ACHATA},lut=y='if(gt(val,190),255,0)'` },
	{ nome: "inv", filtro: "[0:v]format=gray,negate" },
];

// --amostra N: lê só 1 quadro a cada N. Serve para CONFIRMAR que uma tela não tem nome.
const amostra = Number(o.amostra ?? 0);

// PASSADAS: o Tesseract lê um chip conforme os vizinhos. Medido no estoque em turco
// (18/10/2026): no quadro 164 ele lia só "Ozempic"; com o "Ozempic" borrado, passava a ler
// "Ozivy" ao lado. Uma passada só nunca ia achar os dois.
//
// Então a MESMA regra roda de novo: lê, acha a palavra, guarda a caixa dela; aplica o que já
// tem num vídeo provisório; lê esse vídeo; o que aparecer de novo vira mais uma caixa. Para
// quando uma passada não acha nada novo. As caixas se acumulam e o vídeo entregue é gravado
// UMA vez, a partir do original — o provisório é só para ler, nunca é o que se entrega.
const maxPassadas = Number(o.passadas ?? 4);

/** Extrai todo quadro do vídeo, achatado e binarizado em cada corte. */
function extrai(video, tag) {
	const dirs = LEITURAS.map((l) => {
		const d = join(tmp, `${tag}-${l.nome}`);
		mkdirSync(d, { recursive: true });
		roda("ffmpeg", ["-v", "error", "-i", video, "-filter_complex", `${l.filtro}[v]`,
			"-map", "[v]", "-q:v", "2", "-start_number", "0", join(d, "%05d.jpg")]);
		return d;
	});
	const nomes = readdirSync(dirs[0]).filter((f) => f.endsWith(".jpg")).sort();
	return { dirs, nomes };
}

const lePalavras = (dados) => {
	const palavras = [];
	const anda = (b) => {
		if (b.words) palavras.push(...b.words);
		for (const k of ["paragraphs", "lines"]) if (b[k]) b[k].forEach(anda);
	};
	(dados.blocks || []).forEach(anda);
	return palavras
		.filter((p) => p.confidence > 22 && p.text.trim())
		.map((p) => ({
			x: Math.round(p.bbox.x0 / escala),
			y: Math.round(p.bbox.y0 / escala),
			w: Math.round((p.bbox.x1 - p.bbox.x0) / escala),
			h: Math.round((p.bbox.y1 - p.bbox.y0) / escala),
			texto: p.text,
			nome: ehNome(p.text, alvos),
		}));
};

/**
 * Uma caixa por palavra: leu a palavra, é medicamento, borra a palavra. Só isso.
 *
 * Nada de juntar linha, esticar até a margem ou cobrir o vizinho que o OCR não leu. Toda
 * tentativa de ser esperta aqui acabou borrando o que tinha de ficar legível.
 */
const caixasDaTela = (palavras) => palavras.filter((p) => p.nome).map((p) => ({
	x: Math.max(0, p.x - margemX),
	y: Math.max(0, p.y - margemY),
	w: Math.min(W - Math.max(0, p.x - margemX), p.w + margemX * 2),
	h: p.h + margemY * 2,
	texto: p.texto,
}));

let ocrs = 0, segOcr = 0;

/** Lê um vídeo quadro a quadro e devolve as caixas de cada quadro. */
async function leVideo(video, tag) {
	const { dirs, nomes } = extrai(video, tag);
	const t0 = Date.now();
	const fora = [];
	for (let f = 0; f < nomes.length; f++) {
		if (amostra && f % amostra !== 0) { fora.push([]); continue; }
		const palavras = [];
		for (const dir of dirs) {
			const r = await worker.recognize(join(dir, nomes[f]), {}, { blocks: true });
			palavras.push(...lePalavras(r.data));
		}
		ocrs++;
		fora.push(caixasDaTela(palavras));
		if (f % 30 === 0) console.error(`   ${tag}: quadro ${f}/${nomes.length}`);
	}
	segOcr += (Date.now() - t0) / 1000;
	dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
	return fora;
}

/** Junta as caixas novas às que já existem; devolve quantas eram realmente novas. */
function mescla(base, novas) {
	let n = 0;
	for (let f = 0; f < novas.length; f++) {
		base[f] ??= [];
		for (const c of novas[f]) {
			const jaCoberta = base[f].some((b) => {
				const ix = Math.max(0, Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x));
				const iy = Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y));
				return ix * iy >= 0.5 * c.w * c.h;
			});
			if (!jaCoberta) { base[f].push(c); n++; }
		}
	}
	return n;
}

/** Aplica as caixas no vídeo ORIGINAL e grava em `destino`. */
async function aplica(caixasPorQuadro, destino) {
	mkdirSync(dirname(destino), { recursive: true });
	const dec = spawn("ffmpeg", ["-v", "error", "-i", arquivo, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
		{ stdio: ["ignore", "pipe", "inherit"] });
	const enc = spawn("ffmpeg", ["-y", "-v", "error",
		"-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
		"-i", arquivo, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium",
		"-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", destino],
		{ stdio: ["pipe", "inherit", "inherit"] });
	const porQuadro = W * H * 3;
	let resto = Buffer.alloc(0), idx = 0;
	await new Promise((ok, erro) => {
		dec.stdout.on("data", (pedaco) => {
			resto = resto.length ? Buffer.concat([resto, pedaco]) : pedaco;
			while (resto.length >= porQuadro) {
				const quadro = resto.subarray(0, porQuadro);
				resto = resto.subarray(porQuadro);
				for (const c of caixasPorQuadro[idx] ?? []) borraRegiao(quadro, W, H, c.x, c.y, c.w, c.h, raio);
				idx++;
				if (!enc.stdin.write(quadro)) dec.stdout.pause();
			}
		});
		enc.stdin.on("drain", () => dec.stdout.resume());
		dec.stdout.on("end", () => { enc.stdin.end(); });
		enc.on("close", (c) => (c === 0 ? ok() : erro(new Error(`encoder saiu com ${c}`))));
		dec.on("error", erro);
	});
}

console.error("1/3 lendo o vídeo (três leituras por quadro)…");
const worker = await createWorker(idioma);
const caixasPorQuadro = await leVideo(arquivo, "p0");
let passadas = 0;

if (!o["so-ler"] && o.saida) {
	console.error("2/3 repetindo a leitura até não achar palavra nova…");
	for (let p = 1; p <= maxPassadas; p++) {
		const prov = join(tmp, `p${p}.mp4`);
		await aplica(caixasPorQuadro, prov);
		const novas = await leVideo(prov, `p${p}`);
		const n = mescla(caixasPorQuadro, novas);
		passadas = p;
		console.error(`   passada ${p}: ${n} palavra(s) nova(s)`);
		rmSync(prov, { force: true });
		if (!n) break;
	}
}
await worker.terminate();

const comNome = caixasPorQuadro.filter((c) => c.length).length;
const achados = [...new Set(caixasPorQuadro.flat().map((c) => c.texto))];
console.error(`   ${ocrs} quadros lidos, ${segOcr.toFixed(1)}s`);
console.error(`   nomes: ${achados.join(", ") || "(nenhum)"}`);

if (o["dump-caixas"]) {
	writeFileSync(String(o["dump-caixas"]),
		JSON.stringify(caixasPorQuadro.map((c, i) => ({ quadro: i, caixas: c })), null, 1), "utf8");
	console.error("caixas gravadas em " + o["dump-caixas"]);
}

if (o["so-ler"]) {
	console.log(JSON.stringify({
		quadros: caixasPorQuadro.length, lidos: ocrs,
		comNome, semNome: caixasPorQuadro.length - comNome,
		segundosOCR: Number(segOcr.toFixed(1)), nomes: achados,
	}, null, 2));
	rmSync(tmp, { recursive: true, force: true });
	process.exit(0);
}

if (!o.saida) { console.error("Falta --saida"); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }

console.error("3/3 gravando o vídeo…");
const saida = resolve(String(o.saida));
await aplica(caixasPorQuadro, saida);

rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({
	saida: String(o.saida),
	quadros: caixasPorQuadro.length,
	quadrosLidos: ocrs,
	passadas,
	quadrosComNome: comNome,
	quadrosSemNome: caixasPorQuadro.length - comNome,
	nomesEncontrados: achados,
	segundosOCR: Number(segOcr.toFixed(1)),
	proximo: `node tools/borrar-ocr.mjs "${o.saida}" --so-ler --idioma ${idioma}`,
}, null, 2));
