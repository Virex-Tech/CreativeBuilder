#!/usr/bin/env node
/**
 * Cliente do TrendTrack para o CreativeBuilder: acha os anúncios VENCEDORES dos concorrentes
 * (ativos há muitos dias, por alcance) e baixa o vídeo para virar referência. A chave fica na
 * variável de ambiente TRENDTRACK_API_KEY do computador de cada pessoa — nunca no repositório.
 *
 *   node tools/trendtrack.mjs saldo
 *   node tools/trendtrack.mjs buscar "<nome, domínio, @instagram ou id da página>"
 *   node tools/trendtrack.mjs vencedores --app <slug>                 (usa apps/<slug>/concorrentes.json)
 *   node tools/trendtrack.mjs vencedores --app <slug> --pagina <id> [--pagina <id>...] [--busca "termo"]...
 *        [--dias 14] [--limite 5] [--pais BR]
 *   node tools/trendtrack.mjs baixar <adId> --app <slug>
 *
 * `saldo` e `buscar` são grátis. `vencedores` gasta crédito POR ANÚNCIO devolvido (por isso o
 * --limite baixo por concorrente) e grava a lista em entrada/<slug>/trendtrack/. `baixar` salva o
 * vídeo em entrada/<slug>/trendtrack/<adId>.mp4 — dali segue o fluxo de referência normal
 * (ingest-reference + transcribe + ficha).
 *
 * Mesmo formato de config da plataforma web (pipeline "Concorrentes"), então um
 * apps/<slug>/concorrentes.json serve para os dois caminhos.
 */
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const BASE = process.env.TRENDTRACK_BASE_URL?.trim() || "https://api.trendtrack.io";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- utilidades ----------

function erro(msg, code = 1) {
	console.error(`erro: ${msg}`);
	process.exit(code);
}

function chave() {
	const k = (process.env.TRENDTRACK_API_KEY ?? process.env.TT_API_KEY)?.trim();
	if (!k) {
		erro(
			"TRENDTRACK_API_KEY não está definida neste computador.\n" +
				"  1. No TrendTrack: Configurações do workspace → API → criar chave (tt_live_…).\n" +
				"     O admin do workspace precisa ter habilitado a Public API.\n" +
				'  2. No PowerShell: setx TRENDTRACK_API_KEY "cole-a-chave-aqui"\n' +
				"  3. Feche e abra o PowerShell/VS Code e rode de novo.",
		);
	}
	return k;
}

let creditos = null;

async function api(method, path, body) {
	for (let tentativa = 0; ; tentativa++) {
		const res = await fetch(BASE + path, {
			method,
			headers: { Authorization: `Bearer ${chave()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		if (res.status === 429 && tentativa === 0) {
			const espera = Math.min(Number(res.headers.get("retry-after") ?? 5), 30);
			console.error(`TrendTrack pediu para esperar ${espera}s (limite de requisições)...`);
			await new Promise((r) => setTimeout(r, espera * 1000));
			continue;
		}
		const restante = res.headers.get("x-credits-remaining");
		if (restante !== null) creditos = Number(restante);
		const text = await res.text();
		let json = {};
		try {
			json = text ? JSON.parse(text) : {};
		} catch {
			throw new Error(`resposta inesperada do TrendTrack (HTTP ${res.status}): ${text.slice(0, 200)}`);
		}
		if (!res.ok) {
			const code = json.error?.code ?? `HTTP ${res.status}`;
			const dica =
				code === "workspace_public_api_disabled" ? " — o admin do workspace precisa habilitar a Public API no TrendTrack"
				: ["missing_api_key", "invalid_api_key", "credential_revoked"].includes(code) ? " — confira TRENDTRACK_API_KEY"
				: "";
			throw new Error(`TrendTrack ${code}: ${json.error?.message ?? text.slice(0, 200)}${dica}`);
		}
		return json;
	}
}

function args(argv) {
	const pos = [];
	const flags = { pagina: [], busca: [], pais: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) {
			pos.push(a);
			continue;
		}
		const k = a.slice(2);
		const next = argv[i + 1];
		if (k === "json") flags.json = true;
		else if (Array.isArray(flags[k])) flags[k].push(next), i++;
		else flags[k] = next, i++;
	}
	return { pos, flags };
}

const compacto = (n) =>
	n == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function pastaSaida(slug) {
	if (!slug) erro("informe --app <slug> (a pasta de saída é entrada/<slug>/trendtrack/)");
	return join(root, "entrada", slug, "trendtrack");
}

// ---------- comandos ----------

async function saldo() {
	const json = await api("GET", "/v1/usage");
	const c = json.credits ?? {};
	console.log(`workspace: ${json.workspace?.name ?? json.workspace?.id ?? "?"}`);
	console.log(`créditos restantes: ${c.totalRemaining ?? "?"}`);
	if (json.billing?.plan) console.log(`plano: ${json.billing.plan}`);
}

async function buscar(q) {
	if (!q) erro('uso: node tools/trendtrack.mjs buscar "<nome, domínio, @instagram ou id da página>"');
	const { data = [] } = await api("GET", `/v1/lookup?q=${encodeURIComponent(q)}&limit=10`);
	if (!data.length) return console.log("nada encontrado — tente o domínio da loja/site ou o @ do Instagram");
	for (const h of data) {
		const who = h.advertiser ?? h.brandtracker;
		const pagina = who?.facebookPageId ?? h.advertiser?.id;
		if (who) console.log(`${h.matchType.padEnd(6)} ${h.type.padEnd(13)} ${who.name}  → página ${pagina}`);
		else if (h.shop) console.log(`${h.matchType.padEnd(6)} shop          ${h.shop.name ?? ""} ${h.shop.domain ?? ""}  (loja ${h.shop.id})`);
	}
	console.log('\nUse o número da "página" em --pagina ou em apps/<slug>/concorrentes.json.');
}

async function lerConfig(slug) {
	const arq = join(root, "apps", slug, "concorrentes.json");
	if (!existsSync(arq)) return null;
	return JSON.parse(await readFile(arq, "utf8"));
}

async function vencedores(flags) {
	const slug = flags.app;
	const cfg = (slug && (await lerConfig(slug))) ?? {};
	const paginas = flags.pagina.length ? flags.pagina.map((p) => ({ name: p, pageId: p })) : cfg.competitors ?? [];
	const termos = flags.busca.length ? flags.busca : cfg.keywords ?? [];
	const dias = Number(flags.dias ?? cfg.minDaysRunning ?? 14);
	const limite = Number(flags.limite ?? cfg.perSource ?? 5);
	const paises = flags.pais.length ? flags.pais : cfg.countries ?? [];
	if (!paginas.length && !termos.length) {
		erro(`nenhum concorrente: use --pagina <id> / --busca "termo", ou crie apps/${slug ?? "<slug>"}/concorrentes.json`);
	}

	const achados = new Map();
	for (const c of paginas) {
		const qs = new URLSearchParams({ status: "active", mediaType: "video", sortBy: "reach", order: "desc", limit: String(limite) });
		try {
			const { data = [] } = await api("GET", `/v1/advertisers/${encodeURIComponent(c.pageId)}/ads?${qs}`);
			for (const ad of data) if ((ad.daysRunning ?? 0) >= dias) achados.set(ad.id, ad);
		} catch (e) {
			console.error(`  ${c.name}: ${e.message}`);
		}
	}
	for (const termo of termos) {
		try {
			const { data = [] } = await api("POST", "/v1/ads/query", {
				search: [termo],
				searchType: "adCopy",
				status: "active",
				mediaType: "video",
				sortBy: "reach",
				order: "desc",
				minDaysRunning: dias,
				hideLowReach: true,
				maxAdsPerBrand: 2,
				limit: limite,
				...(paises.length ? { adCountries: { include: paises } } : {}),
			});
			for (const ad of data) achados.set(ad.id, ad);
		} catch (e) {
			console.error(`  "${termo}": ${e.message}`);
		}
	}

	const lista = [...achados.values()].sort((a, b) => (b.metrics?.reach ?? 0) - (a.metrics?.reach ?? 0));
	if (flags.json) return console.log(JSON.stringify(lista, null, 2));

	console.log(`\n${lista.length} vencedores (ativos há ≥ ${dias} dias, por alcance):\n`);
	lista.forEach((ad, i) => {
		const texto = (ad.content?.title ?? ad.content?.body ?? "").replace(/\s+/g, " ").slice(0, 70);
		console.log(
			`${String(i + 1).padStart(2)}. ${ad.id}  ${(ad.advertiser?.name ?? "?").slice(0, 24).padEnd(24)} ` +
				`${String(ad.daysRunning ?? "?").padStart(4)}d  alcance ${compacto(ad.metrics?.reach).padStart(6)}  ${texto}`,
		);
	});

	if (slug && lista.length) {
		const dir = pastaSaida(slug);
		await mkdir(dir, { recursive: true });
		const arq = join(dir, `vencedores-${new Date().toISOString().slice(0, 10)}.json`);
		await writeFile(arq, JSON.stringify(lista, null, 2));
		console.log(`\nlista salva em ${arq.replace(root + "/", "").replace(root + "\\", "")}`);
	}
	if (creditos !== null) console.log(`créditos TrendTrack restantes: ${creditos}`);
	console.log("próximo: node tools/trendtrack.mjs baixar <adId> --app <slug>");
}

async function baixar(adId, flags) {
	if (!adId) erro("uso: node tools/trendtrack.mjs baixar <adId> --app <slug>");
	const dir = pastaSaida(flags.app);
	const { data } = await api("GET", `/v1/ads/${encodeURIComponent(adId)}/media-url`);
	if (!data?.url) erro("o TrendTrack não devolveu URL de mídia para este anúncio");
	if (data.mediaType && data.mediaType !== "video") console.error(`aviso: mídia é ${data.mediaType}, não vídeo`);

	await mkdir(dir, { recursive: true });
	const ext = data.mediaType === "video" ? ".mp4" : ".jpg";
	const saida = join(dir, `${adId}${ext}`);
	const res = await fetch(data.url, { redirect: "follow" });
	if (!res.ok || !res.body) erro(`falha ao baixar (HTTP ${res.status}) — a URL pode ter expirado; rode de novo`);
	await pipeline(Readable.fromWeb(res.body), createWriteStream(saida));

	// Copy/transcrição/métricas do anúncio, se estiver numa lista de vencedores já salva.
	let info = null;
	try {
		for (const f of (await readdir(dir)).filter((f) => f.startsWith("vencedores-")).sort().reverse()) {
			info = JSON.parse(await readFile(join(dir, f), "utf8")).find((a) => a.id === adId) ?? null;
			if (info) break;
		}
	} catch {
		// sem lista salva — segue só com o vídeo
	}
	await writeFile(join(dir, `${adId}.json`), JSON.stringify({ media: data, ad: info }, null, 2));

	const rel = saida.replace(root + "/", "").replace(root + "\\", "");
	console.log(`vídeo salvo em ${rel}`);
	console.log(`próximo: node tools/ingest-reference.mjs "${rel}" --out references/${flags.app}-tt-${adId}`);
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = args(rest);

try {
	if (cmd === "saldo") await saldo();
	else if (cmd === "buscar") await buscar(pos.join(" "));
	else if (cmd === "vencedores") await vencedores(flags);
	else if (cmd === "baixar") await baixar(pos[0], flags);
	else {
		console.log(
			"uso:\n" +
				"  node tools/trendtrack.mjs saldo\n" +
				'  node tools/trendtrack.mjs buscar "<concorrente>"\n' +
				"  node tools/trendtrack.mjs vencedores --app <slug> [--pagina <id>] [--busca \"termo\"] [--dias 14] [--limite 5] [--pais BR]\n" +
				"  node tools/trendtrack.mjs baixar <adId> --app <slug>",
		);
		process.exit(cmd ? 1 : 0);
	}
} catch (e) {
	erro(e.message);
}
