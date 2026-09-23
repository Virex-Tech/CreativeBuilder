#!/usr/bin/env node
/**
 * Biblioteca de Anúncios da Meta — API OFICIAL (grátis). Acha os anúncios em vídeo ATIVOS dos
 * concorrentes, rankeia por tempo no ar / alcance e baixa o vídeo do anúncio escolhido.
 * Alternativa grátis ao TrendTrack, com um limite da própria Meta: anúncio COMERCIAL só aparece
 * se foi veiculado na UE/Reino Unido. Concorrente que anuncia só no Brasil não vem — para ele,
 * cole o link do anúncio (fonte manual: `baixar <link>`).
 *
 *   node tools/biblioteca.mjs vencedores --app <slug>             (usa apps/<slug>/concorrentes.json)
 *   node tools/biblioteca.mjs vencedores --app <slug> --pagina <id> [--busca "termo"] [--dias 14] [--limite 5] [--pais DE]
 *   node tools/biblioteca.mjs baixar <id do anúncio | link da Biblioteca> --app <slug>
 *
 * Token: META_AD_LIBRARY_TOKEN (usuário com acesso à Ad Library API — app Meta + verificação de
 * identidade em facebook.com/ID). `baixar` não precisa de token: usa o yt-dlp no link público.
 * Termos da Meta: nada de coleta em lote pelo site — só a API oficial e downloads pontuais.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSAO = process.env.META_API_VERSION?.trim() || "v23.0";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EU_UK = ["DE", "FR", "ES", "IT", "PT", "NL", "BE", "IE", "AT", "PL", "SE", "DK", "FI", "GB"];
const CAMPOS =
	"id,page_id,page_name,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies," +
	"ad_creative_link_titles,ad_creative_link_captions,publisher_platforms,languages,eu_total_reach";

function erro(msg, code = 1) {
	console.error(`erro: ${msg}`);
	process.exit(code);
}

function token() {
	const t = (process.env.META_AD_LIBRARY_TOKEN ?? process.env.META_ACCESS_TOKEN)?.trim();
	if (!t) {
		erro(
			"META_AD_LIBRARY_TOKEN não está definida neste computador.\n" +
				"  1. Confirme sua identidade em https://www.facebook.com/ID (libera a Ad Library API).\n" +
				"  2. Crie um app em developers.facebook.com e gere um token de usuário no Graph API Explorer.\n" +
				'  3. No PowerShell: setx META_AD_LIBRARY_TOKEN "cole-o-token"  e reabra o terminal.\n' +
				"Sem token dá para usar só o `baixar <link>` (fonte manual).",
		);
	}
	return t;
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
		if (Array.isArray(flags[k])) flags[k].push(argv[++i]);
		else flags[k] = argv[++i];
	}
	return { pos, flags };
}

const dias = (ad) => {
	if (!ad.ad_delivery_start_time) return 0;
	const fim = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time).getTime() : Date.now();
	return Math.floor((fim - new Date(ad.ad_delivery_start_time).getTime()) / 86_400_000);
};

async function arquivo(params, limite) {
	const qs = new URLSearchParams({
		...params,
		ad_active_status: "ACTIVE",
		ad_type: "ALL",
		media_type: "VIDEO",
		fields: CAMPOS,
		limit: String(Math.min(limite * 4, 100)),
		access_token: token(),
	});
	const res = await fetch(`https://graph.facebook.com/${VERSAO}/ads_archive?${qs}`);
	const json = await res.json().catch(() => ({}));
	if (!res.ok || json.error) {
		const e = json.error ?? {};
		const dica = [10, 190, 200].includes(e.code) ? " — o token precisa de acesso à Ad Library API (facebook.com/ID)" : "";
		throw new Error(`Meta ${e.code ?? res.status}: ${e.message ?? "erro"}${dica}`);
	}
	return json.data ?? [];
}

async function vencedores(flags) {
	const slug = flags.app;
	const arqCfg = slug ? join(root, "apps", slug, "concorrentes.json") : null;
	const cfg = arqCfg && existsSync(arqCfg) ? JSON.parse(await readFile(arqCfg, "utf8")) : {};
	const paginas = flags.pagina.length ? flags.pagina.map((p) => ({ name: p, pageId: p })) : cfg.competitors ?? [];
	const termos = flags.busca.length ? flags.busca : cfg.keywords ?? [];
	const minDias = Number(flags.dias ?? cfg.minDaysRunning ?? 14);
	const limite = Number(flags.limite ?? cfg.perSource ?? 5);
	const paises = JSON.stringify(flags.pais.length ? flags.pais : cfg.libraryCountries?.length ? cfg.libraryCountries : EU_UK);
	if (!paginas.length && !termos.length) {
		erro(`nenhum concorrente: use --pagina <id> / --busca "termo", ou crie apps/${slug ?? "<slug>"}/concorrentes.json`);
	}

	const achados = new Map();
	const rankear = (ads) =>
		ads
			.filter((a) => dias(a) >= minDias)
			.sort((a, b) => (b.eu_total_reach ?? 0) - (a.eu_total_reach ?? 0) || dias(b) - dias(a))
			.slice(0, limite)
			.forEach((a) => achados.set(a.id, a));
	for (const c of paginas) {
		try {
			rankear(await arquivo({ search_page_ids: JSON.stringify([c.pageId]), ad_reached_countries: paises }, limite));
		} catch (e) {
			console.error(`  ${c.name}: ${e.message}`);
		}
	}
	for (const termo of termos) {
		try {
			rankear(await arquivo({ search_terms: termo, ad_reached_countries: paises }, limite));
		} catch (e) {
			console.error(`  "${termo}": ${e.message}`);
		}
	}

	const lista = [...achados.values()].sort((a, b) => dias(b) - dias(a));
	console.log(`\n${lista.length} vencedores (ativos há ≥ ${minDias} dias, países ${paises}):\n`);
	lista.forEach((ad, i) => {
		const texto = (ad.ad_creative_bodies?.[0] ?? ad.ad_creative_link_titles?.[0] ?? "").replace(/\s+/g, " ").slice(0, 60);
		const alcance = ad.eu_total_reach ? `alcance UE ${ad.eu_total_reach}` : "";
		console.log(`${String(i + 1).padStart(2)}. ${ad.id}  ${(ad.page_name ?? "?").slice(0, 22).padEnd(22)} ${String(dias(ad)).padStart(4)}d  ${alcance}  ${texto}`);
	});
	if (!lista.length) console.log("Nada? Se o concorrente só anuncia no Brasil, a API oficial não mostra — cole o link do anúncio em `baixar`.");

	if (slug && lista.length) {
		const dir = join(root, "entrada", slug, "biblioteca");
		await mkdir(dir, { recursive: true });
		const arq = join(dir, `vencedores-${new Date().toISOString().slice(0, 10)}.json`);
		await writeFile(arq, JSON.stringify(lista, null, 2));
		console.log(`\nlista salva em entrada/${slug}/biblioteca/`);
	}
	console.log("próximo: node tools/biblioteca.mjs baixar <id> --app <slug>");
}

function baixar(alvo, flags) {
	if (!alvo || !flags.app) erro("uso: node tools/biblioteca.mjs baixar <id do anúncio | link> --app <slug>");
	const id = /^\d+$/.test(alvo) ? alvo : new URL(alvo).searchParams.get("id");
	const url = id ? `https://www.facebook.com/ads/library/?id=${id}` : alvo;
	const nome = id ?? `link-${Date.now()}`;
	const dir = join(root, "entrada", flags.app, "biblioteca");
	const saida = join(dir, `${nome}.mp4`);
	const r = spawnSync("yt-dlp", ["--no-playlist", "-f", "bv*+ba/b", "--merge-output-format", "mp4", "-o", saida, url], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (r.status !== 0) erro("yt-dlp não conseguiu baixar — confira o link (anúncio precisa estar ativo) ou baixe o vídeo à mão");
	const rel = `entrada/${flags.app}/biblioteca/${nome}.mp4`;
	console.log(`\nvídeo salvo em ${rel}`);
	console.log(`próximo: node tools/ingest-reference.mjs "${rel}" --out references/${flags.app}-bib-${nome}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = args(rest);
try {
	if (cmd === "vencedores") await vencedores(flags);
	else if (cmd === "baixar") baixar(pos[0], flags);
	else {
		console.log(
			"uso:\n" +
				"  node tools/biblioteca.mjs vencedores --app <slug> [--pagina <id>] [--busca \"termo\"] [--dias 14] [--limite 5] [--pais DE]\n" +
				"  node tools/biblioteca.mjs baixar <id do anúncio | link> --app <slug>",
		);
		process.exit(cmd ? 1 : 0);
	}
} catch (e) {
	erro(e.message);
}
