import { env } from "@/lib/env";

/**
 * Meta Marketing API — sobe o MP4 renderizado e cria o anúncio como RASCUNHO.
 *
 * A Marketing API não expõe os "rascunhos" do Gerenciador; o equivalente seguro é o anúncio
 * criado com `status: PAUSED` dentro de um conjunto já existente (que a equipe escolhe e deixa
 * pausado). Este módulo NUNCA ativa nada, nunca cria campanha/conjunto e nunca mexe em
 * orçamento — revisar e publicar continua sendo um clique humano no Gerenciador.
 *
 * Token: System User com `ads_management` (+ `pages_read_engagement` da página), guardado só no
 * servidor. Inerte sem META_ACCESS_TOKEN + META_AD_ACCOUNT_ID: as rotas respondem 503.
 */

export class MetaDisabledError extends Error {
	constructor() {
		super("Meta Ads indisponível: configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no servidor");
		this.name = "MetaDisabledError";
	}
}

export function metaEnabled(): boolean {
	return Boolean(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);
}

const graph = (path: string): string => `https://graph.facebook.com/${env.META_API_VERSION}/${path}`;
const account = (): string => {
	const id = env.META_AD_ACCOUNT_ID ?? "";

	return id.startsWith("act_") ? id : `act_${id}`;
};

async function call<T>(method: "GET" | "POST", path: string, form?: FormData): Promise<T> {
	if (!metaEnabled()) throw new MetaDisabledError();
	const sep = path.includes("?") ? "&" : "?";
	const res = await fetch(
		method === "GET" ? `${graph(path)}${sep}access_token=${encodeURIComponent(env.META_ACCESS_TOKEN ?? "")}` : graph(path),
		{ method, body: form, signal: AbortSignal.timeout(10 * 60_000) },
	);
	const json = (await res.json().catch(() => ({}))) as T & {
		error?: { message?: string; error_user_msg?: string; code?: number };
	};
	if (!res.ok || json.error) {
		const e = json.error;
		throw new Error(`Meta ${e?.code ?? res.status}: ${e?.error_user_msg ?? e?.message ?? "erro desconhecido"}`);
	}

	return json;
}

function formWith(fields: Record<string, unknown>): FormData {
	const form = new FormData();
	form.set("access_token", env.META_ACCESS_TOKEN ?? "");
	for (const [k, v] of Object.entries(fields)) {
		if (v === undefined || v === null) continue;
		form.set(k, typeof v === "string" ? v : JSON.stringify(v));
	}

	return form;
}

/** Espera o vídeo ficar `ready` — criativo com vídeo ainda processando é recusado. */
async function waitVideoReady(videoId: string): Promise<void> {
	const deadline = Date.now() + 10 * 60_000;
	for (;;) {
		const v = await call<{ status?: { video_status?: string } }>("GET", `${videoId}?fields=status`);
		const s = v.status?.video_status;
		if (s === "ready") return;
		if (s === "error") throw new Error("Meta: processamento do vídeo falhou");
		if (Date.now() > deadline) throw new Error("Meta: vídeo não ficou pronto em 10 min");
		await new Promise((r) => setTimeout(r, 5000));
	}
}

async function preferredThumbnail(videoId: string): Promise<string | undefined> {
	const t = await call<{ data?: { uri: string; is_preferred?: boolean }[] }>("GET", `${videoId}/thumbnails`);

	return (t.data?.find((x) => x.is_preferred) ?? t.data?.[0])?.uri;
}

export interface DraftInput {
	name: string;
	video: Blob;
	adsetId: string;
	pageId: string;
	instagramUserId?: string;
	link: string;
	message: string;
	title?: string;
	callToAction: string;
}

export interface DraftResult {
	videoId: string;
	creativeId: string;
	adId: string;
	/** Link direto pro anúncio no Gerenciador, pra revisão humana. */
	managerUrl: string;
}

/** Vídeo → criativo → anúncio PAUSED no conjunto indicado. */
export async function createDraftAd(input: DraftInput): Promise<DraftResult> {
	if (!metaEnabled()) throw new MetaDisabledError();

	const upload = formWith({ name: input.name });
	upload.set("source", input.video, `${input.name}.mp4`);
	const video = await call<{ id: string }>("POST", `${account()}/advideos`, upload);
	await waitVideoReady(video.id);
	const thumb = await preferredThumbnail(video.id);

	const creative = await call<{ id: string }>(
		"POST",
		`${account()}/adcreatives`,
		formWith({
			name: input.name,
			object_story_spec: {
				page_id: input.pageId,
				...(input.instagramUserId ? { instagram_user_id: input.instagramUserId } : {}),
				video_data: {
					video_id: video.id,
					...(thumb ? { image_url: thumb } : {}),
					message: input.message,
					...(input.title ? { title: input.title } : {}),
					call_to_action: { type: input.callToAction, value: { link: input.link } },
				},
			},
		}),
	);

	const ad = await call<{ id: string }>(
		"POST",
		`${account()}/ads`,
		formWith({
			name: input.name,
			adset_id: input.adsetId,
			creative: { creative_id: creative.id },
			// Trava do módulo: rascunho = pausado. Nunca ACTIVE daqui.
			status: "PAUSED",
		}),
	);

	const act = account().replace(/^act_/, "");

	return {
		videoId: video.id,
		creativeId: creative.id,
		adId: ad.id,
		managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${act}&selected_ad_ids=${ad.id}`,
	};
}
