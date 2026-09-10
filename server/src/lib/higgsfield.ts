import { env } from "@/lib/env";

/**
 * Fase 3 — geração de b-roll no Higgsfield.
 *
 * A API é assíncrona: submete a um endpoint de modelo, recebe { request_id, status_url },
 * e faz poll no status_url até um estado terminal. Saída de vídeo em `video.url`. A URL do
 * provedor expira em ~7 dias, então quem armazena deve baixar o arquivo (o chamador decide).
 *
 * Inerte sem credenciais: `higgsfieldEnabled()` é false e os endpoints respondem 503.
 * O path do modelo é configurável (HIGGSFIELD_VIDEO_ENDPOINT) porque varia por modelo.
 */

export class HiggsfieldDisabledError extends Error {
	constructor() {
		super(
			"geração de b-roll indisponível: configure HIGGSFIELD_API_KEY_ID, HIGGSFIELD_API_KEY_SECRET e HIGGSFIELD_VIDEO_ENDPOINT no servidor",
		);
		this.name = "HiggsfieldDisabledError";
	}
}

export function higgsfieldEnabled(): boolean {
	return Boolean(env.HIGGSFIELD_API_KEY_ID && env.HIGGSFIELD_API_KEY_SECRET && env.HIGGSFIELD_VIDEO_ENDPOINT);
}

interface SubmitResponse {
	status: string;
	request_id: string;
	status_url: string;
}

interface StatusResponse {
	status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string;
	request_id: string;
	error?: string | null;
	video?: { url: string } | null;
	images?: { url: string }[] | null;
}

function authHeader(): string {
	if (!env.HIGGSFIELD_API_KEY_ID || !env.HIGGSFIELD_API_KEY_SECRET) throw new HiggsfieldDisabledError();

	return `Key ${env.HIGGSFIELD_API_KEY_ID}:${env.HIGGSFIELD_API_KEY_SECRET}`;
}

/** Body extra opcional (model/duration/etc.) vindo de HIGGSFIELD_VIDEO_PARAMS. */
function extraParams(): Record<string, unknown> {
	try {
		const parsed = JSON.parse(env.HIGGSFIELD_VIDEO_PARAMS);

		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

async function submitVideo(prompt: string): Promise<SubmitResponse> {
	if (!higgsfieldEnabled()) throw new HiggsfieldDisabledError();
	const res = await fetch(`${env.HIGGSFIELD_BASE_URL}${env.HIGGSFIELD_VIDEO_ENDPOINT}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: authHeader() },
		body: JSON.stringify({ prompt, ...extraParams() }),
	});
	if (!res.ok) {
		throw new Error(`Higgsfield submit falhou (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
	}

	return (await res.json()) as SubmitResponse;
}

async function pollUntilDone(statusUrl: string): Promise<string> {
	// status_url costuma ser absoluto; se vier relativo, prefixa a base.
	const url = statusUrl.startsWith("http") ? statusUrl : `${env.HIGGSFIELD_BASE_URL}${statusUrl}`;
	const deadline = Date.now() + env.HIGGSFIELD_TIMEOUT_MS;

	for (;;) {
		const res = await fetch(url, { headers: { Authorization: authHeader() } });
		if (res.ok) {
			const body = (await res.json()) as StatusResponse;
			if (body.status === "completed") {
				const out = body.video?.url ?? body.images?.[0]?.url;
				if (!out) throw new Error("Higgsfield concluiu sem URL de saída");

				return out;
			}
			if (body.status === "failed" || body.status === "nsfw" || body.status === "canceled") {
				throw new Error(`Higgsfield ${body.status}${body.error ? `: ${body.error}` : ""}`);
			}
		}
		if (Date.now() > deadline) throw new Error("Higgsfield: timeout aguardando a geração");
		await new Promise((r) => setTimeout(r, env.HIGGSFIELD_POLL_INTERVAL_MS));
	}
}

/** Submete um prompt e devolve a URL do vídeo gerado (bloqueia até terminar). */
export async function generateVideo(prompt: string): Promise<{ url: string; requestId: string }> {
	const submitted = await submitVideo(prompt);
	const url = await pollUntilDone(submitted.status_url);

	return { url, requestId: submitted.request_id };
}
