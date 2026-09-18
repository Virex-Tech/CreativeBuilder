import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { codexEnabled, codexRun } from "@/lib/codexClient";
import { env } from "@/lib/env";
import { isSpec, reflow, validateSpec, type Spec, type SpecIssues } from "@/lib/spec";

/**
 * Fase 2 — a IA escreve e reescreve o CreativeSpec.
 *
 * Porta o skill `criativo` para o servidor: dado um brief ou uma referência (frames já
 * extraídos pela ingestão), o modelo escreve o JSON do spec; para um ajuste, reescreve o
 * spec atual. Nunca "edita vídeo" — só o JSON, que o Remotion renderiza.
 *
 * O provider é escolhido por `AI_PROVIDER`: "codex" chama o Codex CLI logado por OAuth (sem
 * chave no servidor) e "anthropic" usa o SDK com ANTHROPIC_API_KEY. A validação reaproveita
 * `validateSpec` (a mesma dos endpoints), com uma rodada de reparo: se o primeiro JSON tiver
 * erro de shape, os erros voltam pro modelo corrigir.
 */

export class AgentDisabledError extends Error {
	constructor() {
		super(
			env.AI_PROVIDER === "codex"
				? "geração por IA indisponível: rode `codex login` e monte o CODEX_HOME no servidor"
				: "geração por IA indisponível: configure ANTHROPIC_API_KEY no servidor",
		);
		this.name = "AgentDisabledError";
	}
}

export function agentEnabled(): boolean {
	return env.AI_PROVIDER === "codex" ? codexEnabled() : Boolean(env.ANTHROPIC_API_KEY);
}

/** Mensagem de 503 coerente com o provider ativo (ex.: kind = "geração", "ajuste", "análise"). */
export function agentDisabledMessage(kind: string): string {
	return env.AI_PROVIDER === "codex"
		? `${kind} por IA indisponível: rode \`codex login\` e monte o CODEX_HOME no servidor`
		: `${kind} por IA indisponível: configure ANTHROPIC_API_KEY no servidor`;
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

/** Prompt neutro de provider: system + conteúdo do usuário + frames de referência (arquivos). */
interface Prompt {
	system: string;
	text: string;
	imagePaths: string[];
}

function anthropic(): Anthropic {
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

/** Resultado de tentar transformar a resposta do modelo num spec válido. */
type Evaluation =
	| { status: "ok"; spec: Spec; issues: SpecIssues }
	| { status: "invalid"; retry: string }
	| { status: "errors"; spec: Spec; issues: SpecIssues; retry: string };

/** Parse + validação compartilhados pelos dois providers. */
function evaluate(text: string, director: Record<string, unknown>): Evaluation {
	let parsed: unknown;
	try {
		parsed = extractJson(text);
	} catch {
		return { status: "invalid", retry: "Isso não era JSON válido. Responda com APENAS o JSON do CreativeSpec." };
	}
	if (!isSpec(parsed)) {
		return { status: "invalid", retry: 'Faltou specVersion "1" ou scenes[]. Corrija e responda só o JSON.' };
	}

	const spec = reflow(parsed);
	const issues = validateSpec(spec, director);
	if (issues.errors.length === 0) return { status: "ok", spec, issues };

	return {
		status: "errors",
		spec,
		issues,
		retry: `O spec tem erros: ${issues.errors.join("; ")}. Corrija e responda só o JSON.`,
	};
}

/** Resolve os caminhos dos frames extraídos de uma referência (teto para não estourar contexto). */
async function referenceFramePaths(storageDir: string, referenceId: string): Promise<string[]> {
	const framesDir = join(storageDir, "references", referenceId, "frames");
	let files: string[];
	try {
		files = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
	} catch {
		return [];
	}

	return files.slice(0, 16).map((f) => join(framesDir, f));
}

/** Carrega frames como blocos de imagem base64 (visão) — caminho Anthropic. */
async function imageBlocks(paths: string[]): Promise<Anthropic.ImageBlockParam[]> {
	const blocks: Anthropic.ImageBlockParam[] = [];
	for (const path of paths) {
		const data = await readFile(path);
		blocks.push({
			type: "image",
			source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") },
		});
	}

	return blocks;
}

/** Gera o spec via SDK da Anthropic, com uma rodada de reparo por histórico de mensagens. */
async function completeAnthropic(
	prompt: Prompt,
	director: Record<string, unknown>,
): Promise<{ spec: Spec; issues: SpecIssues }> {
	const client = anthropic();
	const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: prompt.text }];
	content.push(...(await imageBlocks(prompt.imagePaths)));
	const messages: Anthropic.MessageParam[] = [{ role: "user", content }];

	for (let attempt = 0; attempt < 2; attempt++) {
		const res = await client.messages.create({
			model: env.ANTHROPIC_MODEL,
			max_tokens: 16000,
			thinking: { type: "adaptive" },
			system: prompt.system,
			messages,
		});
		const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
		const result = evaluate(text, director);
		if (result.status === "ok") return { spec: result.spec, issues: result.issues };
		if (attempt === 1) {
			if (result.status === "errors") return { spec: result.spec, issues: result.issues };
			throw new Error("modelo não produziu um CreativeSpec válido");
		}
		messages.push({ role: "assistant", content: text });
		messages.push({ role: "user", content: result.retry });
	}

	throw new Error("falha ao gerar o spec");
}

/** Gera o spec via Codex CLI (OAuth). Cada tentativa é stateless; o reparo vai no prompt. */
async function completeCodex(
	prompt: Prompt,
	director: Record<string, unknown>,
): Promise<{ spec: Spec; issues: SpecIssues }> {
	let text = prompt.text;

	for (let attempt = 0; attempt < 2; attempt++) {
		const out = await codexRun({
			prompt: `${prompt.system}\n\n${text}`,
			imagePaths: attempt === 0 ? prompt.imagePaths : [], // imagens só na 1ª tentativa
		});
		const result = evaluate(out, director);
		if (result.status === "ok") return { spec: result.spec, issues: result.issues };
		if (attempt === 1) {
			if (result.status === "errors") return { spec: result.spec, issues: result.issues };
			throw new Error("Codex não produziu um CreativeSpec válido");
		}
		text += `\n\nSua resposta anterior foi:\n${out}\n\n${result.retry}`;
	}

	throw new Error("falha ao gerar o spec");
}

/** Despacha para o provider configurado. */
function complete(
	prompt: Prompt,
	director: Record<string, unknown>,
): Promise<{ spec: Spec; issues: SpecIssues }> {
	return env.AI_PROVIDER === "codex" ? completeCodex(prompt, director) : completeAnthropic(prompt, director);
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

/** Gera um CreativeSpec novo a partir de um brief e/ou de uma referência. */
export async function authorSpec(input: AuthorInput): Promise<{ spec: Spec; issues: SpecIssues }> {
	const system = `${SPEC_RULES}\n\nDirectorProfile do app (regras de estilo que valem para todo vídeo):\n${JSON.stringify(input.app.director)}\n\nBrandKit:\n${JSON.stringify(input.app.brandKit)}`;

	let text = `App: ${input.app.name} (appId "${input.app.id}"). Locale: ${input.locale}. Nome do criativo: "${input.name}".`;
	if (input.brief) text += `\n\nBrief:\n${input.brief}`;

	let imagePaths: string[] = [];
	if (input.referenceId) {
		imagePaths = await referenceFramePaths(input.storageDir, input.referenceId);
		if (imagePaths.length) {
			text += `\n\nReferência (${imagePaths.length} frames nos cortes reais). Copie SÓ a estrutura e o ritmo — nunca a marca, o texto ou os assets da referência. Manifest: ${JSON.stringify(input.referenceManifest ?? {})}`;
		}
	}
	text += "\n\nEscreva o CreativeSpec completo para este app. Preencha o conteúdo do app, respeitando o DirectorProfile. appId deve ser o id acima. Responda só o JSON.";

	return complete({ system, text, imagePaths }, input.app.director);
}

/**
 * Fase 5 — a "2ª IA" que analisa o que deu certo. Recebe as métricas por criativo (já
 * calculadas do CSV) + um resumo dos specs e diagnostica por posição: o que segurou o
 * público, o que matou, e o que variar em seguida. Devolve texto (markdown).
 */
export async function diagnoseMetrics(payload: unknown): Promise<string> {
	const system =
		"Você é analista de performance de criativos de vídeo. Recebe métricas por posição " +
		"(hook rate = 2s iniciais, hold rate = p75/plays, CTR, quartis) cruzadas com o spec de " +
		"cada criativo. Diagnostique: o que está segurando/perdendo o público e EM QUAL trecho, " +
		"o que deu certo e por quê, e recomende variações concretas (dimensão + mudança) para os " +
		"próximos testes. Seja específico e acionável. Responda em markdown, em português.";
	const user = `Dados (por criativo):\n${JSON.stringify(payload)}`;

	if (env.AI_PROVIDER === "codex") {
		return codexRun({ prompt: `${system}\n\n${user}` });
	}

	const client = anthropic();
	const res = await client.messages.create({
		model: env.ANTHROPIC_MODEL,
		max_tokens: 4000,
		thinking: { type: "adaptive" },
		system,
		messages: [{ role: "user", content: user }],
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
	const text = `Spec atual:\n${JSON.stringify(current)}\n\nAjuste pedido: ${instruction}\n\nReescreva o spec inteiro com o ajuste aplicado, mantendo o resto igual. Responda só o JSON.`;

	return complete({ system, text, imagePaths: [] }, director);
}
