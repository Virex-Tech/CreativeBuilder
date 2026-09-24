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

// ---------------------------------------------------------------------------------------
// Veo 3.1 — take de pessoa falando (estúdio). Roda na API própria (/api/v1/veo/*), que é onde
// se escolhe Fast/Lite/Quality. Não bloqueia: o laço do estúdio consulta o status a cada volta.
// ---------------------------------------------------------------------------------------

/** Créditos por geração de 8s (US$ 0,005/crédito) — mesma tabela de tools/kie-precos.json. */
export const VEO_CREDITS: Record<string, number> = { veo3_fast: 60, veo3_lite: 30, veo3: 250 };
export const KIE_CREDIT_USD = 0.005;

export async function startVeo(prompt: string, model: string): Promise<string> {
	const res = await fetch(`${env.KIE_BASE_URL}/api/v1/veo/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: authHeader() },
		body: JSON.stringify({ prompt, model, aspectRatio: "9:16", enableTranslation: false }),
	});
	const body = (await res.json().catch(() => ({}))) as CreateTaskResponse;
	const taskId = body.data?.taskId;
	if (!res.ok || body.code !== 200 || !taskId) {
		throw new Error(`kie.ai Veo recusou (HTTP ${res.status}): ${body.msg ?? JSON.stringify(body).slice(0, 300)}`);
	}

	return taskId;
}

/** Acha URLs de vídeo em qualquer formato de resposta (o Veo muda o envelope entre versões). */
function videoUrls(data: unknown): string[] {
	const found: string[] = [];
	const visit = (v: unknown, k = ""): void => {
		if (typeof v === "string") {
			if (/^\s*[[{]/.test(v)) {
				try {
					visit(JSON.parse(v), k);

					return;
				} catch {
					// não era JSON
				}
			}
			if (/^https?:\/\//.test(v) && /url/i.test(k)) found.push(v);
		} else if (Array.isArray(v)) v.forEach((x) => visit(x, k));
		else if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) visit(vv, kk);
	};
	visit(data);

	return [...new Set(found)].filter((u) => !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u));
}

export type VeoState = { state: "generating" } | { state: "done"; url: string } | { state: "failed"; error: string };

export async function veoStatus(taskId: string): Promise<VeoState> {
	const res = await fetch(`${env.KIE_BASE_URL}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`, {
		headers: { Authorization: authHeader() },
	});
	if (!res.ok) return { state: "generating" };
	const body = (await res.json()) as { code?: number; msg?: string; data?: Record<string, unknown> | null };
	// Tarefa que a kie não conhece (código 422): falha já, em vez de "gerando" até o timeout.
	if (body.code && body.code !== 200) return { state: "failed", error: `kie.ai: ${body.msg ?? `código ${body.code}`}` };
	const data = body.data ?? {};
	// successFlag: 0 = gerando, 1 = pronto, 2/3 = falhou.
	const flag = Number(data.successFlag);
	if (flag === 1) {
		const url = videoUrls(data)[0];

		return url ? { state: "done", url } : { state: "failed", error: "Veo concluiu sem URL de vídeo" };
	}
	if (flag === 2 || flag === 3) {
		return { state: "failed", error: String(data.errorMessage ?? data.failMsg ?? "a kie.ai não conseguiu gerar") };
	}

	return { state: "generating" };
}

/** Saldo em créditos (null se a consulta falhar — o custo ainda aparece). */
export async function kieCredits(): Promise<number | null> {
	try {
		const res = await fetch(`${env.KIE_BASE_URL}/api/v1/chat/credit`, { headers: { Authorization: authHeader() } });
		const body = (await res.json()) as { code?: number; data?: number };

		return body.code === 200 && typeof body.data === "number" ? body.data : null;
	} catch {
		return null;
	}
}
