import { env } from "@/lib/env";

/**
 * Biblioteca de Anúncios da Meta — API OFICIAL (`/ads_archive`). Fonte gratuita de vencedores,
 * alternativa ao TrendTrack.
 *
 * Limite que não é nosso: anúncio COMERCIAL só volta se foi veiculado na UE/Reino Unido (regra
 * de transparência da DSA); fora disso a API só devolve anúncio político. Concorrente que anuncia
 * só no Brasil não aparece aqui — para ele, use a fonte manual (colar o link) ou o TrendTrack.
 *
 * A API não entrega o arquivo de vídeo: o pipeline baixa pelo link público da Biblioteca
 * (`facebook.com/ads/library/?id=`) com yt-dlp, um anúncio por vez, só dos escolhidos.
 *
 * Token: usuário com acesso à Ad Library API (app Meta + verificação de identidade em
 * facebook.com/ID). META_AD_LIBRARY_TOKEN; se vazio, tenta o META_ACCESS_TOKEN.
 */

export function adLibraryEnabled(): boolean {
	return Boolean(env.META_AD_LIBRARY_TOKEN || env.META_ACCESS_TOKEN);
}

export const adLibraryUrl = (id: string): string => `https://www.facebook.com/ads/library/?id=${id}`;

/** Países da UE/UK usados quando o app não define `countries` — onde anúncio comercial é visível. */
const EU_UK = ["DE", "FR", "ES", "IT", "PT", "NL", "BE", "IE", "AT", "PL", "SE", "DK", "FI", "GB"];

export interface LibraryAd {
	id: string;
	page_id?: string;
	page_name?: string;
	ad_delivery_start_time?: string;
	ad_delivery_stop_time?: string;
	ad_creative_bodies?: string[];
	ad_creative_link_titles?: string[];
	ad_creative_link_captions?: string[];
	ad_snapshot_url?: string;
	publisher_platforms?: string[];
	languages?: string[];
	eu_total_reach?: number;
}

const FIELDS = [
	"id",
	"page_id",
	"page_name",
	"ad_delivery_start_time",
	"ad_delivery_stop_time",
	"ad_creative_bodies",
	"ad_creative_link_titles",
	"ad_creative_link_captions",
	"ad_snapshot_url",
	"publisher_platforms",
	"languages",
	"eu_total_reach",
].join(",");

/** Dias no ar, contados do início da veiculação até hoje (ou até o fim, se parou). */
export function daysRunning(ad: LibraryAd): number | null {
	if (!ad.ad_delivery_start_time) return null;
	const start = new Date(ad.ad_delivery_start_time).getTime();
	const end = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time).getTime() : Date.now();

	return Math.max(0, Math.floor((end - start) / 86_400_000));
}

async function archive(params: Record<string, string>, limit: number): Promise<LibraryAd[]> {
	const token = env.META_AD_LIBRARY_TOKEN || env.META_ACCESS_TOKEN;
	if (!token) throw new Error("Biblioteca da Meta indisponível: configure META_AD_LIBRARY_TOKEN no servidor");

	const qs = new URLSearchParams({
		...params,
		ad_active_status: "ACTIVE",
		ad_type: "ALL",
		media_type: "VIDEO",
		fields: FIELDS,
		// A API pagina em lotes; pedimos folga porque o filtro de dias é nosso.
		limit: String(Math.min(limit * 4, 100)),
		access_token: token,
	});
	const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/ads_archive?${qs}`, {
		signal: AbortSignal.timeout(60_000),
	});
	const json = (await res.json().catch(() => ({}))) as {
		data?: LibraryAd[];
		error?: { message?: string; code?: number; error_subcode?: number };
	};
	if (!res.ok || json.error) {
		const e = json.error;
		const hint =
			e?.code === 10 || e?.code === 190 || e?.code === 200
				? " — o token precisa de acesso à Ad Library API (verificação de identidade em facebook.com/ID)"
				: "";
		throw new Error(`Biblioteca da Meta ${e?.code ?? res.status}: ${e?.message ?? "erro"}${hint}`);
	}

	return json.data ?? [];
}

export interface LibraryFilter {
	limit: number;
	minDaysRunning: number;
	countries: string[];
}

/** Rankeia: alcance UE quando existe, senão tempo no ar (quem banca por mais tempo está vendendo). */
function rank(ads: LibraryAd[], f: LibraryFilter): LibraryAd[] {
	return ads
		.filter((a) => (daysRunning(a) ?? 0) >= f.minDaysRunning)
		.sort((a, b) => (b.eu_total_reach ?? 0) - (a.eu_total_reach ?? 0) || (daysRunning(b) ?? 0) - (daysRunning(a) ?? 0))
		.slice(0, f.limit);
}

const countriesParam = (f: LibraryFilter): string => JSON.stringify(f.countries.length ? f.countries : EU_UK);

/** Anúncios ativos em vídeo de UMA página (concorrente). */
export async function pageWinners(pageId: string, f: LibraryFilter): Promise<LibraryAd[]> {
	const ads = await archive({ search_page_ids: JSON.stringify([pageId]), ad_reached_countries: countriesParam(f) }, f.limit);

	return rank(ads, f);
}

/** Anúncios ativos em vídeo por termo de busca. */
export async function termWinners(term: string, f: LibraryFilter): Promise<LibraryAd[]> {
	const ads = await archive({ search_terms: term, ad_reached_countries: countriesParam(f) }, f.limit);

	return rank(ads, f);
}
