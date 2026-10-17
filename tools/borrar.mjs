#!/usr/bin/env node
/**
 * Borra regiões de uma gravação de tela — feito para cobrir o nome dos medicamentos.
 *
 * A equipe quer TODOS os nomes de medicamento ilegíveis nas gravações do app, em todos os
 * idiomas. O borrão é por FAIXA DE TEMPO, não por caixa fixa: a tela rola, e a linha dos
 * nomes muda de altura ao longo do vídeo. Cada idioma é uma gravação própria, com tempos e
 * posições diferentes — não dá para repetir as faixas de um idioma no outro.
 *
 * Fluxo:
 *   1) node tools/borrar.mjs amostra <video>
 *      → grade de 6 quadros com os tempos, para ver onde o nome aparece e quando sai de cena
 *   2) node tools/borrar.mjs aplicar <video> --saida <out.mp4> \
 *        --faixa "4,63,92,9@0-7.5" --faixa "4,8,92,9@7.5-10"
 *   3) node tools/borrar.mjs amostra <out.mp4>
 *      → confere o resultado antes de usar
 *
 * Formato da faixa: "x,y,largura,altura@inicio-fim"
 *   - x,y,largura,altura em % do quadro (canto superior esquerdo)
 *   - inicio-fim em segundos; sem "@" a faixa vale o vídeo inteiro;
 *     "@3-" vale de 3s até o fim.
 *
 * Dica: deixe a faixa com folga (uns 2% a mais de cada lado). Nome cortado pela metade é
 * nome legível.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

function args(argv) {
	const out = { _: [], faixa: [], trilha: [] };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const k = a.slice(2);
			const v = argv[i + 1]?.startsWith("--") ? true : argv[++i];
			if (k === "faixa") out.faixa.push(v);
			else if (k === "trilha") out.trilha.push(v);
			else out[k] = v ?? true;
		} else out._.push(a);
	}
	return out;
}

function roda(cmd, lista) {
	const r = spawnSync(cmd, lista, { encoding: "utf8" });
	if (r.status !== 0) {
		console.error(`${cmd} falhou:\n${(r.stderr || r.stdout || "").slice(-2000)}`);
		process.exit(1);
	}
	return (r.stdout || "").trim();
}

function dimensoes(arquivo) {
	const s = roda("ffprobe", [
		"-v", "error", "-select_streams", "v:0",
		"-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", arquivo,
	]);
	const [w, h] = s.split("x").map(Number);
	return { w, h };
}

function duracao(arquivo) {
	return Number(roda("ffprobe", [
		"-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arquivo,
	])) || 0;
}

/** Grade de 6 quadros com os tempos impressos no JSON de saída. */
function amostra(arquivo, destino) {
	const d = duracao(arquivo);
	const n = 6;
	const alvo = resolve(destino || `render/out/_rascunho/amostra-${Date.now()}.png`);
	mkdirSync(dirname(alvo), { recursive: true });
	const passo = d > 0 ? d / (n + 1) : 1;
	const tempos = Array.from({ length: n }, (_, i) => (i + 1) * passo);
	const tmpDir = resolve("render/out/_rascunho");
	mkdirSync(tmpDir, { recursive: true });
	for (const [i, t] of tempos.entries()) {
		roda("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", arquivo,
			"-frames:v", "1", resolve(tmpDir, `.b-${String(i)}.png`)]);
	}
	roda("ffmpeg", ["-y", "-loglevel", "error", "-start_number", "0",
		"-i", resolve(tmpDir, ".b-%d.png"),
		"-vf", "scale=380:-1,tile=3x2:margin=10:padding=10:color=#12091F",
		"-frames:v", "1", alvo]);
	console.log(JSON.stringify({
		amostra: alvo,
		duracaoSeg: Number(d.toFixed(2)),
		origem: dimensoes(arquivo),
		quadros: tempos.map((t) => Number(t.toFixed(2))),
		dica: 'faixa = "x,y,larg,alt@inicio-fim" em % do quadro e segundos',
	}, null, 2));
}

/** "4,63,92,9@0-7.5" → { x, y, w, h, ini, fim } em pixels/segundos. */
function leFaixa(txt, W, H, dur) {
	const [caixa, janela] = String(txt).split("@");
	const p = caixa.split(",").map(Number);
	if (p.length !== 4 || p.some((v) => !Number.isFinite(v))) {
		console.error(`faixa inválida: "${txt}" — use "x,y,largura,altura@inicio-fim" em %`);
		process.exit(1);
	}
	const par = (v) => Math.max(2, Math.round(v / 2) * 2); // dimensão par, exigência do codec
	const w = par((p[2] / 100) * W);
	const h = par((p[3] / 100) * H);
	const x = Math.min(W - w, Math.max(0, Math.round((p[0] / 100) * W)));
	const y = Math.min(H - h, Math.max(0, Math.round((p[1] / 100) * H)));
	let ini = 0, fim = dur;
	if (janela) {
		const [a, b] = janela.split("-");
		if (a !== "") ini = Number(a);
		if (b !== undefined && b !== "") fim = Number(b);
	}
	return { x, y, w, h, ini, fim };
}

/**
 * "3,94,4@0:65,7:65,7.4:23,10:15" → faixa FINA que acompanha a rolagem.
 *
 * x, largura e altura ficam fixos; o y anda entre os pontos `tempo:y`. É isso que evita a
 * caixa alta: em vez de cobrir todo o caminho da rolagem, a faixa desce/sobe junto com a linha.
 */
function leTrilha(txt, W, H, dur) {
	const [caixa, pontosTxt] = String(txt).split("@");
	const [px, pw, ph] = caixa.split(",").map(Number);
	if (![px, pw, ph].every(Number.isFinite) || !pontosTxt) {
		console.error(`trilha inválida: "${txt}" — use "x,largura,altura@tempo:y,tempo:y,..."`);
		process.exit(1);
	}
	const par = (v) => Math.max(2, Math.round(v / 2) * 2);
	const w = par((pw / 100) * W);
	const h = par((ph / 100) * H);
	const x = Math.min(W - w, Math.max(0, Math.round((px / 100) * W)));
	const pontos = pontosTxt.split(",").map((p) => {
		const [t, y] = p.split(":").map(Number);
		return { t, y: Math.min(H - h, Math.max(0, Math.round((y / 100) * H))) };
	}).sort((a, b) => a.t - b.t);

	// Expressão de y em função de t: segura nas pontas, interpola no meio.
	let expr = String(pontos[pontos.length - 1].y);
	for (let i = pontos.length - 2; i >= 0; i--) {
		const a = pontos[i], b = pontos[i + 1];
		const lerp = `(${a.y}+(t-${a.t})*(${b.y - a.y})/${(b.t - a.t).toFixed(4)})`;
		expr = `if(lt(t,${b.t}),${lerp},${expr})`;
	}
	expr = `if(lt(t,${pontos[0].t}),${pontos[0].y},${expr})`;
	return { x, w, h, expr, ini: pontos[0].t, fim: pontos[pontos.length - 1].t, pontos };
}

function aplicar(arquivo, o) {
	if (!o.saida) {
		console.error("Falta --saida (ex.: render/public/app/ozempro/br/<nome>.mp4)");
		process.exit(1);
	}
	if (o.faixa.length === 0 && (o.trilha ?? []).length === 0) {
		console.error('Falta --faixa "x,y,larg,alt@ini-fim" ou --trilha "x,larg,alt@t:y,t:y" (pode repetir)');
		process.exit(1);
	}
	const { w: W, h: H } = dimensoes(arquivo);
	const dur = duracao(arquivo);
	const faixas = o.faixa.map((f) => leFaixa(f, W, H, dur));
	const trilhas = (o.trilha ?? []).map((t) => leTrilha(t, W, H, dur));
	const sigma = Number(o.sigma ?? 24);

	// Uma etapa por faixa: recorta, borra e sobrepõe de volta na janela de tempo.
	const partes = [];
	let atual = "0:v";
	faixas.forEach((f, i) => {
		partes.push(`[${atual}]split=2[base${i}][src${i}]`);
		partes.push(`[src${i}]crop=${f.w}:${f.h}:${f.x}:${f.y},gblur=sigma=${sigma}[bl${i}]`);
		partes.push(
			`[base${i}][bl${i}]overlay=${f.x}:${f.y}:enable='between(t,${f.ini},${f.fim})'[v${i}]`,
		);
		atual = `v${i}`;
	});

	// Trilhas: crop e overlay usam a MESMA expressão de y, então a faixa anda junto com a tela.
	trilhas.forEach((f, i) => {
		const j = `t${String(i)}`;
		partes.push(`[${atual}]split=2[base${j}][src${j}]`);
		partes.push(`[src${j}]crop=${f.w}:${f.h}:${f.x}:'${f.expr}',gblur=sigma=${sigma}[bl${j}]`);
		partes.push(
			`[base${j}][bl${j}]overlay=${f.x}:'${f.expr}':enable='between(t,${f.ini},${f.fim})'[v${j}]`,
		);
		atual = `v${j}`;
	});

	const saida = resolve(String(o.saida));
	mkdirSync(dirname(saida), { recursive: true });
	roda("ffmpeg", [
		"-y", "-loglevel", "error", "-i", arquivo,
		"-filter_complex", partes.join(";"),
		"-map", `[${atual}]`, "-map", "0:a?",
		"-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
		"-c:a", "copy",
		saida,
	]);

	console.log(JSON.stringify({
		saida: String(o.saida),
		origem: `${W}x${H}`,
		duracaoSeg: Number(dur.toFixed(2)),
		sigma,
		trilhas: trilhas.map((f) => ({
			caixaPx: `${f.w}x${f.h} em x=${f.x}`,
			pontos: f.pontos.map((p) => `${p.t}s → y=${p.y}px`),
		})),
		faixas: faixas.map((f) => ({
			caixaPx: `${f.w}x${f.h} em ${f.x},${f.y}`,
			deSeg: Number(f.ini.toFixed(2)),
			ateSeg: Number(f.fim.toFixed(2)),
		})),
		proximo: `node tools/borrar.mjs amostra "${o.saida}"   # confira antes de usar`,
	}, null, 2));
}

/**
 * Mede o deslocamento vertical da tela, quadro a quadro, direto dos pixels.
 *
 * Medir a posição do nome "no olho", em alguns pontos, e interpolar NÃO funciona: a tela rola
 * o tempo todo e em velocidade irregular, e qualquer erro de 2% deixa o nome legível. Aqui a
 * gente lê uma tira estreita de cada quadro e descobre quanto ela andou em relação ao quadro
 * anterior — isso é exato enquanto o movimento for rolagem vertical, que é o caso.
 */
function rastrear(arquivo, o) {
	const { w: W, h: H } = dimensoes(arquivo);
	const fps = Number(roda("ffprobe", ["-v", "error", "-select_streams", "v:0",
		"-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", arquivo]).split("/").reduce((a, b) => a / b));
	// Tira estreita na coluna dos rótulos: tem texto, então o casamento é confiável.
	// Tira larga e esparsa: pega a estrutura da tela inteira, não um pedaço sem textura.
	const CW = W;
	const CX = 0;
	const bruto = spawnSync("ffmpeg", [
		"-v", "error", "-i", arquivo,
		"-vf", `format=gray`,
		"-f", "rawvideo", "-pix_fmt", "gray", "-",
	], { maxBuffer: 1 << 30, encoding: "buffer" });
	if (bruto.status !== 0) {
		console.error(`ffmpeg falhou ao ler os quadros:
${String(bruto.stderr).slice(-1500)}`);
		process.exit(1);
	}
	const buf = bruto.stdout;
	const porQuadro = CW * H;
	const n = Math.floor(buf.length / porQuadro);
	if (n < 2) { console.error("quadros insuficientes"); process.exit(1); }

	const maxDy = Math.round(H * 0.18);
	const passoLinha = 3;
	const passoCol = 16;

	/** Erro médio entre o quadro a e o quadro b deslocado de dy. Sem corte antecipado: o corte
	 *  comparava média parcial com total e puxava o resultado para dy = 0. */
	const erroEm = (a, b, dy) => {
		let soma = 0, contas = 0;
		const y0 = Math.max(0, -dy), y1 = Math.min(H, H - dy);
		for (let y = y0; y < y1; y += passoLinha) {
			const la = a * porQuadro + y * CW;
			const lb = b * porQuadro + (y + dy) * CW;
			for (let x = 0; x < CW; x += passoCol) {
				const d = buf[la + x] - buf[lb + x];
				soma += d < 0 ? -d : d;
				contas++;
			}
		}
		return contas ? soma / contas : Infinity;
	};

	const desloc = [0];
	for (let f = 1; f < n; f++) {
		// Busca grossa e depois fina: 20x menos contas que varrer tudo de 1 em 1.
		let melhorDy = 0, melhorErro = Infinity;
		for (let dy = -maxDy; dy <= maxDy; dy += 8) {
			const e = erroEm(f - 1, f, dy);
			if (e < melhorErro) { melhorErro = e; melhorDy = dy; }
		}
		const base = melhorDy;
		for (let dy = base - 8; dy <= base + 8; dy++) {
			if (dy === base) continue;
			const e = erroEm(f - 1, f, dy);
			if (e < melhorErro) { melhorErro = e; melhorDy = dy; }
		}
		desloc.push(desloc[f - 1] + melhorDy);
	}

	// Converte para uma trilha ancorada: no quadro da âncora, y = yAncora.
	const [caixa, anc] = String(o.alvo ?? "").split("@");
	if (!caixa || !anc) {
		console.error('Falta --alvo "x,largura,altura@tempo:y" (tudo em % do quadro, tempo em s)');
		process.exit(1);
	}
	const [px, pw, ph] = caixa.split(",").map(Number);
	const [tAnc, yAnc] = anc.split(":").map(Number);
	const fAnc = Math.max(0, Math.min(n - 1, Math.round(tAnc * fps)));
	const yAncPx = (yAnc / 100) * H;

	const passoSaida = Number(o.passo ?? 1);
	const pontos = [];
	for (let f = 0; f < n; f += passoSaida) {
		const y = yAncPx + (desloc[f] - desloc[fAnc]);
		pontos.push(`${(f / fps).toFixed(3)}:${((y / H) * 100).toFixed(2)}`);
	}
	const trilha = `${px},${pw},${ph}@${pontos.join(",")}`;
	console.log(JSON.stringify({
		quadros: n, fps: Number(fps.toFixed(3)),
		deslocamentoTotalPx: desloc[n - 1],
		ancora: `quadro ${fAnc} (${(fAnc / fps).toFixed(2)}s), y=${yAnc}%`,
		trilha,
	}, null, 2));
}

/**
 * Acha a âncora em CADA quadro e devolve a posição do borrão quadro a quadro.
 *
 * Rastrear "quanto a tela rolou" não funciona: a tela não só rola, ela muda (toque, seleção,
 * redesenho). O que funciona é procurar, em cada quadro, um pedaço fixo da interface que fica
 * logo acima do nome — o rótulo "Médicament (facultatif)", por exemplo — e pôr o borrão na
 * posição em que ele foi achado naquele quadro. Quando o rótulo não está na tela, não há nome,
 * e o borrão sai.
 */
function seguir(arquivo, o) {
	const { w: W, h: H } = dimensoes(arquivo);
	const fps = Number(
		roda("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
			"stream=r_frame_rate", "-of", "csv=p=0", arquivo]).split("/").reduce((a, b) => a / b),
	);

	// --ancora "x,y,largura,altura@tempo": o pedaço da tela que é procurado em todo quadro.
	const [ancCaixa, ancT] = String(o.ancora ?? "").split("@");
	// --caixa "x,y,largura,altura": o borrão, no MESMO quadro da âncora.
	if (!ancCaixa || ancT === undefined || !o.caixa) {
		console.error('Faltam --ancora "x,y,larg,alt@tempo" e --caixa "x,y,larg,alt" (em %)');
		process.exit(1);
	}
	const pc = (v, total) => Math.round((v / 100) * total);
	const [ax, ay, aw, ah] = ancCaixa.split(",").map(Number);
	const [bx, by, bw, bh] = String(o.caixa).split(",").map(Number);
	const AX = pc(ax, W), AY = pc(ay, H), AW = pc(aw, W), AH = pc(ah, H);
	const BX = pc(bx, W), BY = pc(by, H);
	const BW = Math.max(2, Math.round(pc(bw, W) / 2) * 2);
	const BH = Math.max(2, Math.round(pc(bh, H) / 2) * 2);
	const dYcaixa = BY - AY; // o borrão fica a esta distância da âncora, sempre

	// Todos os quadros em cinza, de uma vez.
	const bruto = spawnSync("ffmpeg", [
		"-v", "error", "-i", arquivo, "-vf", "format=gray",
		"-f", "rawvideo", "-pix_fmt", "gray", "-",
	], { maxBuffer: 1 << 30, encoding: "buffer" });
	if (bruto.status !== 0) {
		console.error(`ffmpeg falhou:\n${String(bruto.stderr).slice(-1200)}`);
		process.exit(1);
	}
	const buf = bruto.stdout;
	const porQuadro = W * H;
	const n = Math.floor(buf.length / porQuadro);
	const fAnc = Math.max(0, Math.min(n - 1, Math.round(Number(ancT) * fps)));

	// Modelo: a âncora recortada do quadro de referência, amostrada.
	const passoX = 3, passoY = 2;
	const modelo = [];
	for (let y = 0; y < AH; y += passoY) {
		for (let x = 0; x < AW; x += passoX) {
			modelo.push(buf[fAnc * porQuadro + (AY + y) * W + (AX + x)]);
		}
	}
	const colsModelo = Math.ceil(AW / passoX);

	/** Erro médio entre o modelo e a janela que começa em (AX, y) do quadro f. */
	const erroEm = (f, y) => {
		if (y < 0 || y + AH > H) return Infinity;
		let soma = 0, i = 0;
		const base = f * porQuadro;
		for (let dy = 0; dy < AH; dy += passoY) {
			const linha = base + (y + dy) * W + AX;
			for (let dx = 0; dx < AW; dx += passoX) {
				const d = buf[linha + dx] - modelo[i++];
				soma += d < 0 ? -d : d;
			}
		}
		return soma / Math.max(1, i);
	};

	const limiar = Number(o.limiar ?? 10); // erro médio aceito para dizer "achei"
	const posicoes = [];                   // y do borrão por quadro, ou null
	let ultimo = AY;

	for (let f = 0; f < n; f++) {
		// Busca grossa na altura toda, depois fina em volta do melhor — e começa perto de onde
		// estava no quadro anterior, que é onde quase sempre está.
		let melhorY = -1, melhorErro = Infinity;
		const perto = Math.max(0, ultimo - 120);
		for (let y = perto; y <= Math.min(H - AH, ultimo + 120); y += 4) {
			const e = erroEm(f, y);
			if (e < melhorErro) { melhorErro = e; melhorY = y; }
		}
		if (melhorErro > limiar) {           // não estava por perto: varre a tela inteira
			for (let y = 0; y <= H - AH; y += 6) {
				const e = erroEm(f, y);
				if (e < melhorErro) { melhorErro = e; melhorY = y; }
			}
		}
		for (let y = melhorY - 6; y <= melhorY + 6; y++) {
			const e = erroEm(f, y);
			if (e < melhorErro) { melhorErro = e; melhorY = y; }
		}
		if (melhorErro <= limiar && melhorY >= 0) {
			ultimo = melhorY;
			posicoes.push(Math.max(0, Math.min(H - BH, melhorY + dYcaixa)));
		} else {
			posicoes.push(null);             // âncora fora da tela: não há nome para borrar
		}
	}

	// As posições são medidas QUADRO A QUADRO; aqui elas viram segmentos retos, com tolerância
	// de poucos px. Sem isso a expressão teria um termo por quadro, passaria de 7 mil caracteres
	// e o ffmpeg não configura o filtro. A caixa tem folga de ~14px, então 4px de tolerância
	// não muda nada na tela.
	const tol = Number(o.tolerancia ?? 4);
	const faixasOn = [];
	let ini = null;
	posicoes.forEach((y, f) => {
		if (y === null) {
			if (ini !== null) { faixasOn.push([ini, f - 1]); ini = null; }
			return;
		}
		if (ini === null) ini = f;
	});
	if (ini !== null) faixasOn.push([ini, posicoes.length - 1]);

	// Dentro de cada janela, quebra em trechos que uma reta descreve dentro da tolerância.
	const pedacos = [];
	for (const [a, b] of faixasOn) {
		let p0 = a;
		for (let f = a + 1; f <= b; f++) {
			const y0 = posicoes[p0], y1 = posicoes[f];
			let cabe = true;
			for (let k = p0 + 1; k < f; k++) {
				const prev = y0 + ((y1 - y0) * (k - p0)) / (f - p0);
				if (Math.abs(prev - posicoes[k]) > tol) { cabe = false; break; }
			}
			if (!cabe) { pedacos.push([p0, f - 1]); p0 = f - 1; }
		}
		pedacos.push([p0, b]);
	}

	// y(n) = soma dos trechos, cada um valendo só na sua janela de quadros.
	const termos = pedacos.map(([a, b]) => {
		const ya = posicoes[a], yb = posicoes[b];
		const reta = a === b ? `${ya}` : `(${ya}+(n-${a})*${((yb - ya) / (b - a)).toFixed(4)})`;
		return `${reta}*between(n,${a},${b})`;
	});

	const achados = posicoes.filter((p) => p !== null).length;
	return {
		W, H, n, fps, BX, BW, BH,
		yExpr: termos.length ? termos.join("+") : "0",
		enable: faixasOn.length
			? faixasOn.map(([a, b]) => `between(n,${a},${b})`).join("+")
			: "0",
		achados,
		faixasOn,
		trechos: pedacos.length,
	};
}

/** seguir = acha a âncora em cada quadro e já grava o vídeo borrado. */
function seguirEAplicar(arquivo, o) {
	if (!o.saida) { console.error("Falta --saida"); process.exit(1); }
	const r = seguir(arquivo, o);
	const sigma = Number(o.sigma ?? 24);
	const saida = resolve(String(o.saida));
	mkdirSync(dirname(saida), { recursive: true });
	const filtro = [
		`[0:v]split=2[base][src]`,
		`[src]crop=${r.BW}:${r.BH}:${r.BX}:'${r.yExpr}',gblur=sigma=${sigma}[bl]`,
		`[base][bl]overlay=${r.BX}:'${r.yExpr}':enable='${r.enable}'[v]`,
	].join(";");
	roda("ffmpeg", ["-y", "-loglevel", "error", "-i", arquivo,
		"-filter_complex", filtro, "-map", "[v]", "-map", "0:a?",
		"-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
		"-c:a", "copy", saida]);
	console.log(JSON.stringify({
		saida: String(o.saida),
		quadros: r.n,
		comNome: r.achados,
		semNome: r.n - r.achados,
		janelas: r.faixasOn.map(([a, b]) => `quadros ${a}-${b} (${(a / r.fps).toFixed(2)}s–${(b / r.fps).toFixed(2)}s)`),
		caixaPx: `${r.BW}x${r.BH} em x=${r.BX}`,
		trechos: r.trechos,
		proximo: `node tools/borrar.mjs amostra "${o.saida}"`,
	}, null, 2));
}

const o = args(process.argv);
const [comando, arquivo] = o._;
if (!comando || !arquivo || !existsSync(arquivo)) {
	console.error(
		"Uso:\n" +
			"  node tools/borrar.mjs amostra <video>\n" +
			'  node tools/borrar.mjs aplicar <video> --saida <out.mp4> --faixa "x,y,larg,alt@ini-fim" [--faixa ...] [--sigma 24]',
	);
	process.exit(1);
}
if (comando === "amostra") amostra(arquivo, o.saida);
else if (comando === "rastrear") rastrear(arquivo, o);
else if (comando === "seguir") seguirEAplicar(arquivo, o);
else if (comando === "aplicar") aplicar(arquivo, o);
else {
	console.error(`Comando desconhecido: ${comando} (use "amostra", "rastrear" ou "aplicar")`);
	process.exit(1);
}
