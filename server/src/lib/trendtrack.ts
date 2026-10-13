import { env } from "@/lib/env";

/**
 * TrendTrack Public API (api.trendtrack.io) — acha os anúncios vencedores dos concorrentes.
 *
 * Auth: `Authorization: Bearer tt_live_…` (chave do workspace, criada nas configurações do
 * TrendTrack; o admin do workspace precisa habilitar a Public API). Toda resposta vem no
 * envelope `{ data, requestId }`; erro vem em `{ error: { code, message } }`.
 *
 * Custo: cobrado POR LINHA devolvida, não por request — por isso os `limit` daqui são baixos.
 * `lookup` e `usage` não gastam crédito. O saldo vem no header X-Credits-Remaining.
 *
 * Inerte sem chave: `trendtrackEnabled()` é false e as rotas respondem 503.
 */

export class TrendtrackDisabledError extends Error {
	constructor() {
		super("TrendTrack indisponível: configure TRENDTRACK_API_KEY no servidor");
		this.name = "TrendtrackDisabledError";
	}
}

export function trendtrackEnabled(): boolean {
	return Boolean(env.TRENDTRACK_API_KEY);
}

/** Resumo de anúncio do TrendTrack (PublicApiAdSummaryDto) — só os campos que usamos. */
export interface TtAd {
	id: string;
	status: "active" | "inactive" | "unknown";
	firstSeenAt?: string | null;
	lastSeenAt?: string | null;
	daysRunning?: number | null;
	media?: { type?: string; thumbnailUrl?: string | null; mediaUrl?: string | null } | null;
	advertiser?: { id?: string; name?: string; logoUrl?: string | null; facebookPageId?: string } | null;
	content?: {
		title?: string | null;
		body?: string | null;
		transcript?: string | null;
		callToAction?: string | null;
		landingPageUrl?: string | null;
	} | null;
	metrics?: { reach?: number | null; estimatedSpend?: number | null; duplicates?: number | null; reachDelta7d?: number | null } | null;
}

export interface TtLookupHit {
	type: "brandtracker" | "advertiser" | "shop";
	matchType: "exact" | "fuzzy";
	score: number;
	advertiser?: { id: string; name: string; facebookPageId?: string } | null;
	brandtracker?: { id: string; name: string; facebookPageId?: string } | null;
	shop?: { id: string; domain?: string; name?: string } | null;
}

interface TtResult<T> {
	data: T;
	creditsRemaining: number | null;
}

async function tt<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<TtResult<T>> {
	if (!env.TRENDTRACK_API_KEY) throw new TrendtrackDisabledError();

	for (let attempt = 0; ; attempt++) {
		const res = await fetch(`${env.TRENDTRACK_BASE_URL}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${env.TRENDTRACK_API_KEY}`,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(60_000),
		});

		// Rate limit: respeita o Retry-After uma vez; na segunda desiste com erro claro.
		if (res.status === 429 && attempt === 0) {
			const wait = Math.min(Number(res.headers.get("retry-after") ?? 5), 30);
			await new Promise((r) => setTimeout(r, wait * 1000));
			continue;
		}

		const text = await res.text();
		let json: { data?: T; error?: { code?: string; message?: string } } = {};
		try {
			json = text ? (JSON.parse(text) as typeof json) : {};
		} catch {
			// cai no erro abaixo com o corpo cru
		}
		if (!res.ok) {
			const code = json.error?.code ?? `HTTP ${res.status}`;
			const hint =
				code === "workspace_public_api_disabled"
					? " — o admin do workspace precisa habilitar a Public API no TrendTrack"
					: ["missing_api_key", "invalid_api_key", "credential_revoked"].includes(code)
						? " — confira TRENDTRACK_API_KEY"
						: "";
			throw new Error(`TrendTrack ${code}: ${json.error?.message ?? text.slice(0, 200)}${hint}`);
		}

		const remaining = res.headers.get("x-credits-remaining");

		return { data: json.data as T, creditsRemaining: remaining === null ? null : Number(remaining) };
	}
}

/** Saldo e plano do workspace. Não gasta crédito. */
export async function usage(): Promise<{ totalRemaining: number | null; raw: unknown }> {
	if (!env.TRENDTRACK_API_KEY) throw new TrendtrackDisabledError();
	// /v1/usage devolve o snapshot na raiz (não em `data`).
	const res = await fetch(`${env.TRENDTRACK_BASE_URL}/v1/usage`, {
		headers: { Authorization: `Bearer ${env.TRENDTRACK_API_KEY}` },
		signal: AbortSignal.timeout(20_000),
	});
	const json = (await res.json().catch(() => ({}))) as {
		credits?: { totalRemaining?: number };
		error?: { code?: string; message?: string };
	};
	if (!res.ok) throw new Error(`TrendTrack ${json.error?.code ?? res.status}: ${json.error?.message ?? ""}`);

	return { totalRemaining: json.credits?.totalRemaining ?? null, raw: json };
}

/** Resolve marca, domínio, id de página do Facebook ou @ do Instagram. Não gasta crédito. */
export async function lookup(q: string, limit = 8): Promise<TtLookupHit[]> {
	const { data } = await tt<TtLookupHit[]>("GET", `/v1/lookup?q=${encodeURIComponent(q)}&limit=${limit}`);

	return data ?? [];
}

export interface WinnerFilter {
	limit: number;
	minDaysRunning: number;
	mediaType?: "video" | "image" | "all";
}

/**
 * Anúncios ATIVOS de um anunciante, por alcance. "Vencedor" = está no ar há pelo menos
 * `minDaysRunning` dias: ninguém mantém gastando num criativo que não converte.
 */
export async function advertiserWinners(pageId: string, f: WinnerFilter): Promise<TtResult<TtAd[]>> {
	const qs = new URLSearchParams({
		status: "active",
		mediaType: f.mediaType ?? "video",
		sortBy: "reach",
		order: "desc",
		limit: String(f.limit),
	});
	const out = await tt<TtAd[]>("GET", `/v1/advertisers/${encodeURIComponent(pageId)}/ads?${qs}`);

	return { ...out, data: (out.data ?? []).filter((a) => (a.daysRunning ?? 0) >= f.minDaysRunning) };
}

/** Busca por termo (copy do anúncio) no mercado todo — vencedores de quem ainda não é concorrente mapeado. */
export async function keywordWinners(
	terms: string[],
	f: WinnerFilter & { countries?: string[] },
): Promise<TtResult<TtAd[]>> {
	return tt<TtAd[]>("POST", "/v1/ads/query", {
		search: terms,
		searchType: "adCopy",
		keywordMode: "any",
		status: "active",
		mediaType: f.mediaType ?? "video",
		sortBy: "reach",
		order: "desc",
		minDaysRunning: f.minDaysRunning,
		hideLowReach: true,
		maxAdsPerBrand: 2,
		limit: f.limit,
		...(f.countries?.length ? { adCountries: { include: f.countries } } : {}),
	});
}

/** URL do melhor arquivo de mídia do anúncio (só a URL — não baixa nada). */
export async function mediaUrl(adId: string): Promise<{ url: string; mediaType: string; urlType: string }> {
	const { data } = await tt<{ url: string; mediaType: string; urlType: string }>(
		"GET",
		`/v1/ads/${encodeURIComponent(adId)}/media-url`,
	);
	if (!data?.url) throw new Error("TrendTrack não devolveu URL de mídia para este anúncio");

	return data;
}
