#!/usr/bin/env node
/**
 * Cliente da Kie.ai para o CreativeBuilder: gera vídeo (Kling 3.0, Seedance 1.5 Pro, Veo 3.1) e voz (ElevenLabs),
 * espera terminar e baixa o arquivo. A chave fica na variável de ambiente KIE_API_KEY do
 * computador de cada pessoa — nunca no repositório.
 *
 *   node tools/kie.mjs saldo
 *   node tools/kie.mjs modelos
 *   node tools/kie.mjs vozes
 *   node tools/kie.mjs custo <modelo> [--duracao 5] [--resolucao 720p] [--audio]
 *   node tools/kie.mjs gerar <modelo> --prompt "..." --saida render/public/broll/x.mp4
 *        [--duracao 5] [--resolucao 720p] [--audio] [--proporcao 9:16] [--imagem arq.jpg]... --sim
 *   node tools/kie.mjs voz --texto "..." --saida render/public/audio/x.mp3 [--voz "Ana Rita"] [--velocidade 1] --sim
 *   node tools/kie.mjs status <taskId> [--veo]
 *
 * Prompt ou texto longos (ou com aspas): use --prompt-arquivo / --texto-arquivo <arquivo.txt>. O
 * PowerShell do Windows corta argumentos com aspas duplas no meio — foi assim que um teste de Veo
 * saiu com a fala errada.
 *
 * `gerar` e `voz` só gastam créditos com `--sim`; sem ele mostram o custo e saem. Isso é uma
 * trava deliberada: quem opera não é técnico, e uma geração errada custa dinheiro de verdade.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const BASE = "https://api.kie.ai";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const precos = JSON.parse(await readFile(join(root, "tools", "kie-precos.json"), "utf8"));

// Vozes da ElevenLabs disponíveis na Kie (enum fixo da doc). O modelo multilingual v2 fala
// português com qualquer uma; o idioma segue o texto.
const VOZES = {
	"Ana Rita": "wJqPPQ618aTW29mptyoc",
	Laura: "FGY2WhTYpPnrIDTdsKH5",
	Bella: "hpp4J3VqNfWAUOO0d1Us",
	Emma: "pPdl9cQBQq4p6mRkZy2Z",
	Aria: "TC0Zp7WVFzhA8zpTlRqV",
	Hope: "uYXf8XasLslADfZ2MB4u",
	Lucy: "lcMyyd2HUfFzxdCaC4Ta",
	Jessica: "g6xIsTj2HwM6VR4iXFCw",
	Allison: "1wGbFxmAM3Fgw63G1zZJ",
	Liam: "TX3LPaxmHKxFdv7VOQHJ",
	Brian: "nPczCjzI2devNBz1zQrb",
	Callum: "N2lVS1w4EtoT3dr4eOWO",
	Finn: "vBKc2FfBKJfcZNyEt1n6",
	Tom: "DYkrAHD8iwork3YSUBbs",
	Mark: "1SM7GgM6IMuvQlz2BwM3",
};
const VOZ_PADRAO = "Ana Rita";

// Veo roda na API própria (/api/v1/veo/*), que é onde se escolhe Fast/Lite/Quality — o endpoint
// unificado só aceita "veo-3-1" sem variante.
const VEO_MODEL = { "veo3-fast": "veo3_fast", "veo3-lite": "veo3_lite", "veo3-quality": "veo3" };

// ---------- utilidades ----------

function erro(msg, code = 1) {
	console.error(`erro: ${msg}`);
	process.exit(code);
}

function chave() {
	const k = process.env.KIE_API_KEY?.trim();
	if (!k) {
		erro(
			"KIE_API_KEY não está definida neste computador.\n" +
				"  1. Crie a chave em https://kie.ai/api-key\n" +
				'  2. No PowerShell: setx KIE_API_KEY "cole-a-chave-aqui"\n' +
				"  3. Feche e abra o PowerShell/VS Code e rode de novo.",
		);
	}
	return k;
}

async function api(method, path, body) {
	const res = await fetch(BASE + path, {
		method,
		headers: { Authorization: `Bearer ${chave()}`, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`resposta inesperada da Kie (HTTP ${res.status}): ${text.slice(0, 200)}`);
	}
	// A Kie responde HTTP 200 mesmo em erro; o status real vem em `code`.
	const code = Number(json.code ?? res.status);
	if (code !== 200) {
		const dica =
			code === 401 ? " — chave inválida? confira KIE_API_KEY"
			: code === 402 ? " — créditos insuficientes: recarregue em kie.ai"
			: code === 429 ? " — muitas requisições; espere alguns segundos"
			: "";
		throw new Error(`Kie respondeu ${code}: ${json.msg ?? "sem mensagem"}${dica}`);
	}
	return json.data;
}

function args(argv) {
	const pos = [];
	const flags = { imagem: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) {
			pos.push(a);
			continue;
		}
		const k = a.slice(2);
		const next = argv[i + 1];
		const isBool = ["audio", "sim", "veo", "json"].includes(k);
		if (isBool) flags[k] = true;
		else if (k === "imagem") flags.imagem.push(next), i++;
		else flags[k] = next, i++;
	}
	return { pos, flags };
}

function modelo(nome) {
	const m = precos.modelos[nome];
	if (!m) erro(`modelo desconhecido "${nome}". Use: ${Object.keys(precos.modelos).join(", ")}`);
	return m;
}

function estimar(nome, { duracao, resolucao, audio }) {
	const m = modelo(nome);
	const res = resolucao ?? "720p";
	if (!m.resolucoes.includes(res)) erro(`${m.nome} aceita resolução ${m.resolucoes.join(" ou ")}`);
	let dur = Number(duracao ?? (m.cobranca === "por_video" ? 8 : 5));
	if (!m.duracoes.includes(dur)) {
		if (m.cobranca === "por_video") {
			console.error(`aviso: ${m.nome} gera sempre ${m.duracoes[0]}s — ignorando --duracao ${dur}`);
			dur = m.duracoes[0];
		} else erro(`${m.nome} aceita duração de ${m.duracoes[0]} a ${m.duracoes.at(-1)}s`);
	}
	let creditos;
	if (m.cobranca === "por_segundo") {
		const tabela = m.creditosPorSegundo[res];
		const porSeg = audio ? tabela.comAudio : tabela.semAudio;
		if (porSeg === undefined) erro(`${m.nome} não gera áudio — tire --audio`);
		creditos = porSeg * dur;
	} else {
		creditos = m.creditosPorVideo[res];
	}
	return {
		modelo: nome,
		nome: m.nome,
		duracao: dur,
		resolucao: res,
		audio: m.cobranca === "por_video" ? "fala/som nativos" : Boolean(audio),
		creditos,
		usd: Number((creditos * precos.creditoUsd).toFixed(3)),
	};
}

async function upload(caminho) {
	if (/^https?:\/\//i.test(caminho)) return caminho;
	const buf = await readFile(resolve(caminho));
	const tipo = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[
		extname(caminho).toLowerCase()
	];
	if (!tipo) erro(`imagem precisa ser .jpg, .png ou .webp: ${caminho}`);
	if (buf.length > 10 * 1024 * 1024) erro(`imagem acima de 10 MB: ${caminho}`);
	const form = new FormData();
	form.append("file", new Blob([buf], { type: tipo }), basename(caminho));
	form.append("uploadPath", "creativebuilder");
	form.append("fileName", basename(caminho));
	const res = await fetch(`${BASE}/api/file-stream-upload`, {
		method: "POST",
		headers: { Authorization: `Bearer ${chave()}` },
		body: form,
	});
	const json = await res.json().catch(() => ({}));
	const url = json?.data?.downloadUrl;
	if (!url) throw new Error(`upload falhou para ${caminho}: ${json?.msg ?? res.status}`);
	return url;
}

/** Acha as URLs do resultado em qualquer formato de resposta (jobs, veo, callbacks). */
function urlsResultado(data) {
	const achadas = [];
	const visitar = (v, k = "") => {
		if (typeof v === "string") {
			if (/^\s*[[{]/.test(v)) {
				try {
					return visitar(JSON.parse(v), k);
				} catch {
					/* não era JSON */
				}
			}
			if (/^https?:\/\//.test(v) && /url/i.test(k)) achadas.push(v);
		} else if (Array.isArray(v)) v.forEach((x) => visitar(x, k));
		else if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) visitar(vv, kk);
	};
	visitar(data);
	return [...new Set(achadas)].filter((u) => !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u));
}

function estado(data, veo) {
	if (veo) {
		// API do Veo: successFlag 0 = gerando, 1 = pronto, 2/3 = falhou.
		const f = Number(data?.successFlag);
		if (f === 1) return "success";
		if (f === 2 || f === 3) return "fail";
		if (data?.state) return String(data.state);
		return "generating";
	}
	return String(data?.state ?? "waiting");
}

async function consultar(taskId, veo) {
	return veo
		? api("GET", `/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`)
		: api("GET", `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
}

async function esperar(taskId, veo, { timeoutMin = 20, intervaloS = 5 } = {}) {
	const fim = Date.now() + timeoutMin * 60_000;
	let ultimo = "";
	while (Date.now() < fim) {
		const data = await consultar(taskId, veo);
		const st = estado(data, veo);
		if (st !== ultimo) {
			console.error(`  ${new Date().toLocaleTimeString()} — ${st}`);
			ultimo = st;
		}
		if (st === "success") return data;
		if (st === "fail") {
			const motivo = data?.failMsg ?? data?.errorMessage ?? data?.msg ?? "sem motivo informado";
			throw new Error(`a Kie não conseguiu gerar (${data?.failCode ?? data?.errorCode ?? "falha"}): ${motivo}`);
		}
		await new Promise((r) => setTimeout(r, intervaloS * 1000));
	}
	throw new Error(`passou de ${timeoutMin} min sem terminar — consulte depois: node tools/kie.mjs status ${taskId}${veo ? " --veo" : ""}`);
}

async function baixar(url, saida) {
	await mkdir(dirname(resolve(saida)), { recursive: true });
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) throw new Error(`falha ao baixar o resultado (HTTP ${res.status})`);
	await pipeline(Readable.fromWeb(res.body), createWriteStream(resolve(saida)));
}

async function saldo() {
	const creditos = Number(await api("GET", "/api/v1/chat/credit"));
	return { creditos, usd: Number((creditos * precos.creditoUsd).toFixed(2)) };
}

// ---------- comandos ----------

async function lerArquivoSe(f, campo, flag) {
	if (f[flag]) f[campo] = (await readFile(resolve(f[flag]), "utf8")).trim();
}

function previa(texto) {
	return { inicio: texto.slice(0, 140) + (texto.length > 140 ? "…" : ""), fim: texto.length > 140 ? "…" + texto.slice(-80) : undefined, caracteres: texto.length };
}

async function cmdGerar(nome, f) {
	await lerArquivoSe(f, "prompt", "prompt-arquivo");
	if (!f.prompt) erro("falta --prompt (ou --prompt-arquivo arquivo.txt)");
	if (!f.saida) erro("falta --saida (ex.: render/public/broll/app-cena.mp4)");
	const est = estimar(nome, f);
	const veo = nome.startsWith("veo3");
	if (!f.sim) {
		console.log(JSON.stringify({ ...est, prompt: previa(f.prompt), aviso: "nada foi gerado — confira se o prompt está inteiro e rode de novo com --sim" }, null, 2));
		return;
	}
	const antes = await saldo();
	if (antes.creditos < est.creditos) erro(`saldo insuficiente: ${antes.creditos} créditos, precisa de ~${est.creditos}. Recarregue em kie.ai.`);

	const imagens = [];
	for (const img of f.imagem) imagens.push(await upload(img));
	const proporcao = f.proporcao ?? "9:16";

	let taskId;
	if (veo) {
		const body = {
			prompt: f.prompt,
			model: VEO_MODEL[nome],
			aspectRatio: proporcao,
			enableTranslation: false,
		};
		if (imagens.length) {
			body.imageUrls = imagens;
			body.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
		}
		taskId = (await api("POST", "/api/v1/veo/generate", body)).taskId;
	} else if (nome === "seedance-1.5") {
		const input = {
			prompt: f.prompt,
			aspect_ratio: proporcao,
			resolution: est.resolucao,
			duration: est.duracao,
			fixed_lens: false,
			generate_audio: Boolean(f.audio),
		};
		if (imagens.length) input.input_urls = imagens.slice(0, 2);
		taskId = (await api("POST", "/api/v1/jobs/createTask", { model: "bytedance/seedance-1.5-pro", input })).taskId;
	} else {
		const turbo = nome === "kling3-turbo";
		const input = turbo
			? { prompt: f.prompt, duration: String(est.duracao), aspect_ratio: proporcao, resolution: est.resolucao }
			: {
					prompt: f.prompt,
					duration: String(est.duracao),
					aspect_ratio: proporcao,
					mode: est.resolucao === "1080p" ? "pro" : "std",
					sound: Boolean(f.audio),
					multi_shots: false,
				};
		if (imagens.length) input.image_urls = imagens;
		const model = turbo
			? imagens.length
				? "kling/v3-turbo-image-to-video"
				: "kling/v3-turbo-text-to-video"
			: "kling-3.0/video";
		taskId = (await api("POST", "/api/v1/jobs/createTask", { model, input })).taskId;
	}
	console.error(`tarefa criada: ${taskId} (${est.nome}, ~${est.creditos} créditos ≈ US$ ${est.usd})`);

	const data = await esperar(taskId, veo);
	const url = urlsResultado(data)[0];
	if (!url) throw new Error(`a tarefa terminou mas não achei a URL do vídeo: ${JSON.stringify(data).slice(0, 300)}`);
	await baixar(url, f.saida);

	if (veo && est.resolucao === "1080p") {
		console.error("aviso: o Veo entrega 720p aqui; 1080p exige a etapa extra 'get-1080p-video' (ainda não automatizada).");
	}
	const depois = await saldo().catch(() => null);
	const resultado = {
		arquivo: f.saida.replace(/\\/g, "/"),
		taskId,
		provider: "kie",
		modelo: nome,
		prompt: f.prompt,
		duracao: est.duracao,
		resolucao: est.resolucao,
		audio: est.audio,
		creditosEstimados: est.creditos,
		creditosGastos: depois ? antes.creditos - depois.creditos : null,
		saldoRestante: depois,
	};
	await writeFile(`${resolve(f.saida)}.kie.json`, JSON.stringify(resultado, null, 2) + "\n");
	console.log(JSON.stringify(resultado, null, 2));
}

async function cmdVoz(f) {
	await lerArquivoSe(f, "texto", "texto-arquivo");
	if (!f.texto) erro('falta --texto "roteiro falado" (ou --texto-arquivo arquivo.txt)');
	if (!f.saida) erro("falta --saida (ex.: render/public/audio/app-vo.mp3)");
	const nomeVoz = f.voz ?? VOZ_PADRAO;
	const voice = VOZES[nomeVoz] ?? nomeVoz; // aceita nome da lista ou ID direto
	if (!f.sim) {
		console.log(
			JSON.stringify(
				{ voz: nomeVoz, texto: previa(f.texto), aviso: "nada foi gerado — rode de novo com --sim (custo baixo; o saldo é mostrado depois)" },
				null,
				2,
			),
		);
		return;
	}
	const antes = await saldo();
	const input = {
		text: f.texto,
		voice,
		stability: Number(f.estabilidade ?? 0.45),
		similarity_boost: 0.75,
		style: Number(f.estilo ?? 0.2),
		speed: Number(f.velocidade ?? 1),
	};
	const { taskId } = await api("POST", "/api/v1/jobs/createTask", {
		model: "elevenlabs/text-to-speech-multilingual-v2",
		input,
	});
	console.error(`tarefa de voz criada: ${taskId} (${nomeVoz})`);
	let data;
	try {
		data = await esperar(taskId, false, { timeoutMin: 5, intervaloS: 3 });
	} catch (e) {
		throw new Error(
			`${e.message}
  A voz da Kie falhou do lado deles (não cobra). Tente de novo mais tarde; se continuar, use a voz nativa do Veo (pessoa falando) ou a alternativa Higgsfield (text2speech_v2).`,
		);
	}
	const url = urlsResultado(data)[0];
	if (!url) throw new Error(`a voz terminou mas não achei a URL: ${JSON.stringify(data).slice(0, 300)}`);
	await baixar(url, f.saida);
	const depois = await saldo().catch(() => null);
	const resultado = {
		arquivo: f.saida.replace(/\\/g, "/"),
		taskId,
		provider: "kie",
		voz: nomeVoz,
		texto: f.texto,
		creditosGastos: depois ? antes.creditos - depois.creditos : null,
		saldoRestante: depois,
	};
	await writeFile(`${resolve(f.saida)}.kie.json`, JSON.stringify(resultado, null, 2) + "\n");
	console.log(JSON.stringify(resultado, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = args(rest);

const comandos = {
	saldo: async () => console.log(JSON.stringify(await saldo(), null, 2)),
	modelos: async () =>
		console.log(
			JSON.stringify(
				Object.fromEntries(Object.entries(precos.modelos).map(([k, m]) => [k, { nome: m.nome, uso: m.uso, resolucoes: m.resolucoes, duracoes: m.duracoes }])),
				null,
				2,
			),
		),
	vozes: async () => console.log(JSON.stringify({ padrao: VOZ_PADRAO, vozes: VOZES }, null, 2)),
	custo: async () => console.log(JSON.stringify(estimar(pos[0] ?? erro("uso: custo <modelo>"), flags), null, 2)),
	gerar: () => cmdGerar(pos[0] ?? erro("uso: gerar <modelo> --prompt ... --saida ... --sim"), flags),
	voz: () => cmdVoz(flags),
	status: async () => {
		const id = pos[0] ?? erro("uso: status <taskId> [--veo]");
		const data = await consultar(id, flags.veo);
		console.log(JSON.stringify({ taskId: id, estado: estado(data, flags.veo), urls: urlsResultado(data), bruto: data }, null, 2));
	},
};

if (!comandos[cmd]) {
	console.error("comandos: saldo | modelos | vozes | custo | gerar | voz | status   (veja o topo de tools/kie.mjs)");
	process.exit(1);
}

comandos[cmd]().catch((e) => erro(e.message));
