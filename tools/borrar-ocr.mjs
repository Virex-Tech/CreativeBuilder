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
	"mounjaro", "ozempic", "wegovy", "zepbound", "zep", "lié", "lie", "oziv", "saxenda",
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

/** A palavra é um nome de medicamento, mesmo lida com erro? */
function ehNome(texto, alvos) {
	const t = texto.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
	if (!t) return false;
	for (const alvo of alvos) {
		if (t.includes(alvo)) return true;
		// palavra do mesmo tamanho do alvo: aceita 1 erro a cada 5 letras
		// Tolerância só para nome longo: "Olire" (5 letras) aceitaria "Olive" de uma receita, e
		// "Wegovy" aceitaria qualquer palavra parecida. Nome curto exige grafia exata.
		if (Math.abs(t.length - alvo.length) <= 2 && alvo.length >= 7) {
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

const dirN = join(tmp, "n"), dirI = join(tmp, "i");
mkdirSync(dirN); mkdirSync(dirI);
console.error("1/3 extraindo quadros (brilho achatado)…");
roda("ffmpeg", ["-v", "error", "-i", arquivo, "-filter_complex", `${ACHATA}[v]`,
	"-map", "[v]", "-q:v", "2", "-start_number", "0", join(dirN, "%05d.jpg")]);
roda("ffmpeg", ["-v", "error", "-i", arquivo, "-filter_complex", `${ACHATA},negate[v]`,
	"-map", "[v]", "-q:v", "2", "-start_number", "0", join(dirI, "%05d.jpg")]);

const quadros = readdirSync(dirN).filter((f) => f.endsWith(".jpg")).sort();
console.error(`   ${quadros.length} quadros`);

// Quadros em miniatura, para saber quando a tela NÃO mudou e poder reaproveitar a leitura.
// Comparar bytes do JPEG não serve (ruído de compressão faz todo quadro diferir); comparar os
// pixels de uma miniatura mostra a verdade: 37% a 84% dos quadros são a mesma tela.
console.error("2/3 comparando quadros…");
const MW = 135, MH = Math.round((H * MW) / W / 2) * 2;
const mini = spawnSync("ffmpeg", ["-v", "error", "-i", arquivo,
	"-vf", `scale=${MW}:${MH},format=gray`, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
	{ maxBuffer: 1 << 30, encoding: "buffer" }).stdout;
const porMini = MW * MH;
/**
 * Diferença entre dois quadros IGNORANDO brilho e contraste.
 *
 * Quando um modal abre, ele escurece a tela inteira: todos os pixels mudam, mas a estrutura é a
 * mesma. Comparando valores crus, isso parecia rolagem e fazia o borrão ser descartado bem na
 * hora em que o OCR também falhava (texto cinza sobre cinza). Normalizando cada quadro pela sua
 * média e desvio, o escurecimento some da conta e sobra só o que mudou de verdade.
 */
const difNormalizada = (i) => {
	const a = (i - 1) * porMini, b = i * porMini;
	let sa = 0, sb = 0, n = 0;
	for (let k = 0; k < porMini; k += 3) { sa += mini[a + k]; sb += mini[b + k]; n++; }
	const ma = sa / n, mb = sb / n;
	let va = 0, vb = 0;
	for (let k = 0; k < porMini; k += 3) {
		va += (mini[a + k] - ma) ** 2; vb += (mini[b + k] - mb) ** 2;
	}
	const da = Math.sqrt(va / n) || 1, db = Math.sqrt(vb / n) || 1;
	let soma = 0;
	for (let k = 0; k < porMini; k += 3) {
		soma += Math.abs((mini[a + k] - ma) / da - (mini[b + k] - mb) / db);
	}
	return soma / n;
};

const mudou = (i) => (i === 0 ? true : difNormalizada(i) >= 0.035);

// Mudança GRANDE entre quadros = a tela rolou, e as caixas antigas não valem mais.
const rolou = (i) => (i === 0 ? true : difNormalizada(i) >= 0.30);

console.error("2/3 lendo cada quadro…");
const worker = await createWorker(idioma);
const caixasPorQuadro = [];
let anterior = null, igual = 0, ocrs = 0;
const t0 = Date.now();

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
 * Monta o borrão de cada linha que tem nome.
 *
 * O chip selecionado (branco no preto) às vezes não é lido, e ele fica ENTRE as palavras lidas.
 * Por isso o borrão não vai do primeiro ao último nome: vai do fim da última palavra que não é
 * nome (o "Ignorer" da linha) até o fim do último nome. Assim o chip que o OCR perdeu entra
 * junto, e o que não é nome continua legível.
 */
const caixasDaTela = (palavras) => {
	const linhas = [];
	for (const p of palavras) {
		const l = linhas.find((o) => Math.abs(o.cy - (p.y + p.h / 2)) < Math.max(p.h, o.alt) * 0.7);
		if (l) { l.itens.push(p); l.alt = Math.max(l.alt, p.h); }
		else linhas.push({ cy: p.y + p.h / 2, alt: p.h, itens: [p] });
	}
	const fora = [];
	for (const l of linhas) {
		const nomes = l.itens.filter((i) => i.nome);
		if (!nomes.length) continue;
		const primeiro = Math.min(...nomes.map((i) => i.x));
		const ultimo = Math.max(...nomes.map((i) => i.x + i.w));
		// até onde chega a última palavra "inocente" antes do primeiro nome
		// Só palavra DE VERDADE segura o borrão. O OCR cospe lixo entre os chips (")", "”»",
		// pedaços de borda) e, tratado como palavra inocente, esse lixo empurrava o borrão para a
		// direita e deixava o nome à esquerda exposto — o vazamento de 16/10/2026.
		const antes = l.itens
			.filter((i) => !i.nome && i.x + i.w <= primeiro && i.texto.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
			.map((i) => i.x + i.w);
		// Sem palavra inocente à esquerda, o primeiro nome da linha pode ter um vizinho que o OCR
		// não leu (chip selecionado, texto claro em fundo colorido). Estende até a margem.
		const esq = antes.length ? Math.max(...antes) + 8 : Math.round(W * 0.02);
		const topo = Math.min(...nomes.map((i) => i.y));
		const base = Math.max(...nomes.map((i) => i.y + i.h));
		fora.push({
			x: Math.max(0, esq),
			y: Math.max(0, topo - margemY),
			w: Math.min(W, ultimo + margemX) - Math.max(0, esq),
			h: base - topo + margemY * 2,
			texto: nomes.map((i) => i.texto).join("+"),
		});
	}
	return fora;
};

// --amostra N: lê só 1 quadro a cada N. Serve para CONFIRMAR que uma tela não tem nome,
// não para borrar — telas que já se sabe ter nome vão sem amostra.
const amostra = Number(o.amostra ?? 0);
const MAX_SEM_LER = 15;   // meio segundo: teto de segurança mesmo com a tela parada
let desdeUltima = 0;
for (let f = 0; f < quadros.length; f++) {
	if (amostra && f % amostra !== 0) { caixasPorQuadro.push([]); continue; }
	// Tela igual à do quadro anterior: reaproveita as caixas em vez de reler.
	if (f > 0 && !amostra && !mudou(f) && desdeUltima < MAX_SEM_LER) {
		caixasPorQuadro.push(caixasPorQuadro[f - 1]);
		desdeUltima++; igual++;
		continue;
	}
	desdeUltima = 0;
	// Uma leitura do quadro inteiro, mais a invertida (texto claro em fundo escuro).
	const palavras = [];
	for (const dir of [dirN, dirI]) {
		const r = await worker.recognize(join(dir, quadros[f]), {}, { blocks: true });
		palavras.push(...lePalavras(r.data));
	}
	ocrs++;
	// Cada quadro é lido por si. Nada de arrastar caixa de um quadro para o outro: a caixa
	// antiga fica parada enquanto o conteúdo rola e acaba borrando o que não deve (em
	// 16/10/2026 cobriu "Constipação" no histórico). Com a leitura em faixas o OCR acha o nome
	// em praticamente todo quadro, e a muleta só atrapalhava.
	caixasPorQuadro.push(caixasDaTela(palavras));
	if (f % 30 === 0) console.error(`   quadro ${f}/${quadros.length}`);
}
await worker.terminate();
const segOcr = (Date.now() - t0) / 1000;

const comNome = caixasPorQuadro.filter((c) => c.length).length;
const achados = [...new Set(caixasPorQuadro.flat().map((c) => c.texto))];
console.error(`   ${ocrs} quadros lidos, ${igual} iguais ao anterior, ${segOcr.toFixed(1)}s`);
console.error(`   nomes: ${achados.join(", ") || "(nenhum)"}`);

if (o["dump-caixas"]) {
	writeFileSync(String(o["dump-caixas"]),
		JSON.stringify(caixasPorQuadro.map((c, i) => ({ quadro: i, caixas: c })), null, 1), "utf8");
	console.error("caixas gravadas em " + o["dump-caixas"]);
}

if (o["so-ler"]) {
	console.log(JSON.stringify({
		quadros: quadros.length, lidos: ocrs, reaproveitados: igual,
		comNome, semNome: quadros.length - comNome, segundosOCR: Number(segOcr.toFixed(1)),
		nomes: achados,
	}, null, 2));
	rmSync(tmp, { recursive: true, force: true });
	process.exit(0);
}

if (!o.saida) { console.error("Falta --saida"); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }

console.error("3/3 aplicando o borrão…");
const saida = resolve(String(o.saida));
mkdirSync(dirname(saida), { recursive: true });

const dec = spawn("ffmpeg", ["-v", "error", "-i", arquivo, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
	{ stdio: ["ignore", "pipe", "inherit"] });
const enc = spawn("ffmpeg", ["-y", "-v", "error",
	"-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
	"-i", arquivo, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium",
	"-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", saida],
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

rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({
	saida: String(o.saida),
	quadros: quadros.length,
	quadrosLidos: ocrs,
	quadrosIguaisAoAnterior: igual,
	quadrosComNome: comNome,
	quadrosSemNome: quadros.length - comNome,
	nomesEncontrados: achados,
	segundosOCR: Number(segOcr.toFixed(1)),
	proximo: `node tools/borrar.mjs amostra "${o.saida}"`,
}, null, 2));
