import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";
import { isSpec, reflow, validateSpec, type Spec, type SpecIssues } from "@/lib/spec";

/**
 * Fase 2 — a IA escreve e reescreve o CreativeSpec.
 *
 * Porta o skill `criativo` para o servidor: dado um brief ou uma referência (frames já
 * extraídos pela ingestão), o modelo escreve o JSON do spec; para um ajuste, reescreve o
 * spec atual. Nunca "edita vídeo" — só o JSON, que o Remotion renderiza.
 *
 * A validação reaproveita `validateSpec` (a mesma dos endpoints), com uma rodada de reparo:
 * se o primeiro JSON tiver erro de shape, os erros voltam pro modelo corrigir.
 */

export class AgentDisabledError extends Error {
	constructor() {
		super("geração por IA indisponível: configure ANTHROPIC_API_KEY no servidor");
		this.name = "AgentDisabledError";
	}
}

export function agentEnabled(): boolean {
	return Boolean(env.ANTHROPIC_API_KEY);
}

const SPEC_RULES = `
Você produz um CreativeSpec: um JSON que descreve um criativo de vídeo vertical para app,
renderizado pelo Remotion. Você NUNCA descreve edição de vídeo — só escreve este JSON.

REGRA INEGOCIÁVEL: texto, legenda, mockup de app, CTA e logo são SEMPRE camadas
determinísticas (type "text", "app_screen_recording", "badge", "karaoke", "disclaimer",
"solid"). Modelo generativo (type "generative_video") entrega só imagem em movimento (b-roll)
e NUNCA texto/UI — ele erra letra e denuncia o anúncio como IA.

Formato do spec (specVersion "1"):
{
  "specVersion": "1",
  "creativeId": "<string única>",
  "appId": "<id do app>",
  "locale": "pt-BR" | "en-US" | "es-ES" | ...,
  "output": { "kind": "video" },
  "format": { "w": 1080, "h": 1920, "fps": 30 },
  "brandKit": { "bg": "#hex", "fg": "#hex", "accent": "#hex", "fontFamily": "..." },
  "scenes": [
    {
      "id": "<slug único>",
      "role": "HOOK" | "PROBLEM" | "DEMO" | "PROOF" | "CTA" | "POINT",
      "startMs": <int>, "durationMs": <int>, "timing": "flex" | "locked",
      "layers": [ <layer>, ... ]   // pelo menos 1
    }
  ]
}

Tipos de layer:
- { "type": "text", "content": "...", "preset": "hook_stroke"|"sub"|"caption"|"cta_label", "anim": "none"|"pop_in"|"fade_in"|"slide_up"|"punch_in" }
- { "type": "generative_video", "prompt": "<descrição do b-roll>", "provider": "higgsfield"|"fal", "fit": "cover"|"contain" }   // sem assetId ainda; o prompt descreve a cena
- { "type": "app_screen_recording", "device": "iphone15_mock"|"none" }
- { "type": "solid", "color": "#hex" }
- { "type": "badge", "label": "", "value": "<texto curto>" }
- { "type": "karaoke", "text": "..." }
- { "type": "disclaimer", "text": "..." }

Estrutura clássica: HOOK (0..~2.5s) → DEMO/PROOF → CTA. Ritmo de corte rápido no hook.
Responda com APENAS o JSON do CreativeSpec, sem cercas de código, sem comentários.
`.trim();

function client(): Anthropic {
	if (!env.ANTHROPIC_API_KEY) throw new AgentDisabledError();

	return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/** Extrai o JSON do texto do modelo, tolerando cercas ```json acidentais. */
function extractJson(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const raw = (fenced ? fenced[1] : text).trim();
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end === -1) throw new Error("modelo não retornou JSON");

	return JSON.parse(raw.slice(start, end + 1));
}

/** Carrega os frames extraídos de uma referência como blocos de imagem (visão). */
async function referenceImages(
	storageDir: string,
	referenceId: string,
): Promise<Anthropic.ImageBlockParam[]> {
	const framesDir = join(storageDir, "references", referenceId, "frames");
	let files: string[];
	try {
		files = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
	} catch {
		return [];
	}
	// Um teto de frames evita estourar contexto numa referência longa.
	const picked = files.slice(0, 16);
	const blocks: Anthropic.ImageBlockParam[] = [];
	for (const file of picked) {
		const data = await readFile(join(framesDir, file));
		blocks.push({
			type: "image",
			source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") },
		});
	}

	return blocks;
}

interface AuthorInput {
	app: { id: string; name: string; director: Record<string, unknown>; brandKit: Record<string, unknown> };
	name: string;
	locale: string;
	brief?: string;
	referenceId?: string;
	referenceManifest?: Record<string, unknown>;
	storageDir: string;
}

/** Chama o modelo, valida e (se preciso) repara uma vez. Retorna o spec pronto para persistir. */
async function complete(
	system: string,
	userContent: Anthropic.ContentBlockParam[],
	director: Record<string, unknown>,
): Promise<{ spec: Spec; issues: SpecIssues }> {
	const anthropic = client();
	const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];

	for (let attempt = 0; attempt < 2; attempt++) {
		const res = await anthropic.messages.create({
			model: env.ANTHROPIC_MODEL,
			max_tokens: 16000,
			thinking: { type: "adaptive" },
			system,
			messages,
		});
		const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
		let parsed: unknown;
		try {
			parsed = extractJson(text);
		} catch (err) {
			if (attempt === 1) throw err;
			messages.push({ role: "assistant", content: text });
			messages.push({ role: "user", content: "Isso não era JSON válido. Responda com APENAS o JSON do CreativeSpec." });
			continue;
		}

		if (!isSpec(parsed)) {
			if (attempt === 1) throw new Error("modelo não produziu um CreativeSpec válido");
			messages.push({ role: "assistant", content: text });
			messages.push({ role: "user", content: 'Faltou specVersion "1" ou scenes[]. Corrija e responda só o JSON.' });
			continue;
		}

		const spec = reflow(parsed);
		const issues = validateSpec(spec, director);
		if (issues.errors.length === 0) return { spec, issues };

		if (attempt === 1) return { spec, issues }; // devolve com issues; o endpoint decide
		messages.push({ role: "assistant", content: text });
		messages.push({
			role: "user",
			content: `O spec tem erros: ${issues.errors.join("; ")}. Corrija e responda só o JSON.`,
		});
	}

	throw new Error("falha ao gerar o spec");
}

/** Gera um CreativeSpec novo a partir de um brief e/ou de uma referência. */
export async function authorSpec(input: AuthorInput): Promise<{ spec: Spec; issues: SpecIssues }> {
	const system = `${SPEC_RULES}\n\nDirectorProfile do app (regras de estilo que valem para todo vídeo):\n${JSON.stringify(input.app.director)}\n\nBrandKit:\n${JSON.stringify(input.app.brandKit)}`;

	const parts: Anthropic.ContentBlockParam[] = [];
	parts.push({
		type: "text",
		text: `App: ${input.app.name} (appId "${input.app.id}"). Locale: ${input.locale}. Nome do criativo: "${input.name}".`,
	});
	if (input.brief) parts.push({ type: "text", text: `Brief:\n${input.brief}` });
	if (input.referenceId) {
		const imgs = await referenceImages(input.storageDir, input.referenceId);
		if (imgs.length) {
			parts.push({
				type: "text",
				text: `Referência (${imgs.length} frames nos cortes reais). Copie SÓ a estrutura e o ritmo — nunca a marca, o texto ou os assets da referência. Manifest: ${JSON.stringify(input.referenceManifest ?? {})}`,
			});
			parts.push(...imgs);
		}
	}
	parts.push({
		type: "text",
		text: 'Escreva o CreativeSpec completo para este app. Preencha o conteúdo do app, respeitando o DirectorProfile. appId deve ser o id acima. Responda só o JSON.',
	});

	return complete(system, parts, input.app.director);
}

/**
 * Fase 5 — a "2ª IA" que analisa o que deu certo. Recebe as métricas por criativo (já
 * calculadas do CSV) + um resumo dos specs e diagnostica por posição: o que segurou o
 * público, o que matou, e o que variar em seguida. Devolve texto (markdown).
 */
export async function diagnoseMetrics(payload: unknown): Promise<string> {
	const anthropic = client();
	const system =
		"Você é analista de performance de criativos de vídeo. Recebe métricas por posição " +
		"(hook rate = 2s iniciais, hold rate = p75/plays, CTR, quartis) cruzadas com o spec de " +
		"cada criativo. Diagnostique: o que está segurando/perdendo o público e EM QUAL trecho, " +
		"o que deu certo e por quê, e recomende variações concretas (dimensão + mudança) para os " +
		"próximos testes. Seja específico e acionável. Responda em markdown, em português.";
	const res = await anthropic.messages.create({
		model: env.ANTHROPIC_MODEL,
		max_tokens: 4000,
		thinking: { type: "adaptive" },
		system,
		messages: [{ role: "user", content: `Dados (por criativo):\n${JSON.stringify(payload)}` }],
	});

	return res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** Reescreve um spec existente a partir de uma instrução em linguagem natural. */
export async function adjustSpec(
	current: Spec,
	instruction: string,
	director: Record<string, unknown>,
	brandKit: Record<string, unknown>,
): Promise<{ spec: Spec; issues: SpecIssues }> {
	const system = `${SPEC_RULES}\n\nDirectorProfile:\n${JSON.stringify(director)}\n\nBrandKit:\n${JSON.stringify(brandKit)}`;
	const parts: Anthropic.ContentBlockParam[] = [
		{ type: "text", text: `Spec atual:\n${JSON.stringify(current)}` },
		{ type: "text", text: `Ajuste pedido: ${instruction}\n\nReescreva o spec inteiro com o ajuste aplicado, mantendo o resto igual. Responda só o JSON.` },
	];

	return complete(system, parts, director);
}
