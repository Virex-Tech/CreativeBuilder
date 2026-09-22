import { env } from "@/lib/env";

/**
 * Fase 3 — geração de b-roll no kie.ai (unified jobs API).
 *
 * A API é assíncrona: `POST /api/v1/jobs/createTask` devolve { data: { taskId } }, e faz-se
 * poll em `GET /api/v1/jobs/recordInfo?taskId=...` até um estado terminal. A saída vem em
 * `data.resultJson` (uma STRING JSON) contendo `{ resultUrls: [...] }`. A URL do provedor
 * pode expirar, então quem armazena deve baixar o arquivo (o chamador decide).
 *
 * Inerte sem credenciais: `kieEnabled()` é false e os endpoints respondem 503. Ao contrário
 * do Higgsfield, basta a KIE_API_KEY — o modelo (KIE_MODEL) tem default e vale para todos.
 */

export class KieDisabledError extends Error {
	constructor() {
		super("geração de b-roll indisponível: configure KIE_API_KEY no servidor");
		this.name = "KieDisabledError";
	}
}

export function kieEnabled(): boolean {
	return Boolean(env.KIE_API_KEY);
}

interface CreateTaskResponse {
	code: number;
	msg?: string;
	data?: { taskId?: string } | null;
}

interface RecordInfoResponse {
	code: number;
	msg?: string;
	data?: {
		taskId: string;
		state: "waiting" | "queuing" | "generating" | "success" | "fail" | string;
		resultJson?: string | null;
		failCode?: string | null;
		failMsg?: string | null;
	} | null;
}

function authHeader(): string {
	if (!env.KIE_API_KEY) throw new KieDisabledError();

	return `Bearer ${env.KIE_API_KEY}`;
}

/** Campos extra opcionais mesclados no `input` (ex: resolution/duration) via KIE_VIDEO_PARAMS. */
function extraInput(): Record<string, unknown> {
	try {
		const parsed = JSON.parse(env.KIE_VIDEO_PARAMS);

		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

async function createTask(prompt: string): Promise<string> {
	if (!kieEnabled()) throw new KieDisabledError();
	const res = await fetch(`${env.KIE_BASE_URL}/api/v1/jobs/createTask`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: authHeader() },
		body: JSON.stringify({
			model: env.KIE_MODEL,
			// b-roll é vertical por padrão; KIE_VIDEO_PARAMS pode sobrescrever qualquer campo.
			input: { prompt, aspect_ratio: "9:16", ...extraInput() },
		}),
	});
	if (!res.ok) {
		throw new Error(`kie.ai createTask falhou (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
	}
	const body = (await res.json()) as CreateTaskResponse;
	const taskId = body.data?.taskId;
	if (body.code !== 200 || !taskId) {
		throw new Error(`kie.ai createTask sem taskId: ${body.msg ?? JSON.stringify(body).slice(0, 300)}`);
	}

	return taskId;
}

/** Extrai a primeira URL de saída de `resultJson` (que é uma string JSON). */
function firstResultUrl(resultJson: string | null | undefined): string | null {
	if (!resultJson) return null;
	try {
		const parsed = JSON.parse(resultJson) as { resultUrls?: unknown };
		let urls = parsed.resultUrls;
		// resultUrls pode vir como array ou como string JSON ("[...]").
		if (typeof urls === "string") urls = JSON.parse(urls) as unknown;

		return Array.isArray(urls) && typeof urls[0] === "string" ? (urls[0] as string) : null;
	} catch {
		return null;
	}
}

async function pollUntilDone(taskId: string): Promise<string> {
	const url = `${env.KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
	const deadline = Date.now() + env.KIE_TIMEOUT_MS;

	for (;;) {
		const res = await fetch(url, { headers: { Authorization: authHeader() } });
		if (res.ok) {
			const body = (await res.json()) as RecordInfoResponse;
			const data = body.data;
			if (data?.state === "success") {
				const out = firstResultUrl(data.resultJson);
				if (!out) throw new Error("kie.ai concluiu sem URL de saída");

				return out;
			}
			if (data?.state === "fail") {
				throw new Error(`kie.ai fail${data.failMsg ? `: ${data.failMsg}` : ""}`);
			}
		}
		if (Date.now() > deadline) throw new Error("kie.ai: timeout aguardando a geração");
		await new Promise((r) => setTimeout(r, env.KIE_POLL_INTERVAL_MS));
	}
}

/** Submete um prompt e devolve a URL do vídeo gerado (bloqueia até terminar). */
export async function generateVideo(prompt: string): Promise<{ url: string; requestId: string }> {
	const taskId = await createTask(prompt);
	const url = await pollUntilDone(taskId);

	return { url, requestId: taskId };
}
