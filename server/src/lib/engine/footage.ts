// GERADO por render/scripts/build.mjs (npm run build:lib) — cópia fiel de render/src/footage.ts. NÃO EDITE.
// Mude render/src/footage.ts e rode `npm run build:lib` em render/ (`npm run check:lib` acusa cópia velha).
/**
 * Acabamento determinístico de um spec feito de takes gravados — A implementação única.
 *
 * Roda depois de TODA edição (da IA ou de uma pessoa): quem edita escolhe os trechos, isto
 * garante o que ela erra.
 *
 *  1. Corte limpo — o ponto de entrada/saída de cada clipe é puxado pra fronteira de palavra
 *     (um corte no meio de "treino" é o erro que mais denuncia edição automática) e nunca passa
 *     do fim do take. A palavra cortada fica se a maior parte dela está dentro do trecho.
 *  2. Sem fala dobrada — dois clipes seguidos do mesmo take não se sobrepõem.
 *  3. Legenda da fala real — as legendas `karaoke` com `auto: true` são jogadas fora e refeitas
 *     a partir da transcrição de cada clipe, em blocos de até `autoCaptions.maxWords`, com o tempo
 *     exato de cada palavra. Quem edita nunca escreve a legenda: sairia do sincronismo no 1º ajuste.
 *
 * FUNÇÃO PURA e SEM DEPENDÊNCIAS (nem zod, nem Remotion): o spec de entrada não é alterado e os
 * takes vêm do chamador (o servidor busca no banco, o CLI lê do disco, o PayPosts manda no
 * `POST /footage/finalize`). Este arquivo é a fonte; `npm run build:lib` gera a partir dele
 * `render/lib/engine.mjs` (CLI `tools/spec-tool.mjs`) e `server/src/lib/engine/footage.ts`
 * (plataforma). Mude AQUI e rode `npm run build:lib` — nunca edite as cópias geradas.
 */

export interface TakeWord {
	/** A palavra como foi falada (com pontuação: ela quebra o bloco de legenda). */
	w: string;
	startMs: number;
	endMs: number;
}

export interface FootageTake {
	/** Casado com `layer.takeId`. */
	id: string;
	/**
	 * URL/caminho do vídeo do take — vira o `src` das layers desse take. Vazio/null = mantém o
	 * `src` que a layer já tem (e o take só casa por `takeId`).
	 */
	src: string | null;
	durationMs: number;
	words: TakeWord[];
}

/** Formato aceito na entrada: `w` (contrato) ou `word` (saída do transcribe/whisper). */
export type FootageTakeInput = Omit<FootageTake, "words" | "src"> & {
	src?: string | null;
	words?: ({ startMs: number; endMs: number } & ({ w: string } | { word: string }))[] | null;
};

export interface FinalizeFootageResult<S> {
	spec: S;
	warnings: string[];
	stats: { clips: number; captionBlocks: number; durationMs: number };
}

interface FootageLayer {
	type: "footage";
	takeId?: string;
	src: string;
	startFromMs?: number;
	startMs?: number;
	durationMs?: number;
	volume?: number;
	[key: string]: unknown;
}

/** O mínimo que o acabamento lê de um spec (o resto passa intacto). */
export interface SceneLike {
	id: string;
	startMs: number;
	durationMs: number;
	layers: unknown[];
}

export interface SpecLike {
	scenes: SceneLike[];
	autoCaptions?: unknown;
}

/** Folga antes da 1ª palavra e depois da última: corte colado na sílaba soa cortado. */
export const LEAD_MS = 60;
export const TAIL_MS = 120;
/** Pausa que quebra o bloco de legenda mesmo antes de encher. */
export const GAP_BREAK_MS = 350;
/** Clipe mínimo. */
const MIN_CLIP_MS = 300;

const isFootage = (l: unknown): l is FootageLayer =>
	!!l && typeof l === "object" && (l as { type?: string }).type === "footage";

const isAutoCaption = (l: unknown): boolean =>
	!!l && typeof l === "object" && (l as { type?: string }).type === "karaoke" && !!(l as { auto?: boolean }).auto;

/** Ids de take citados pelas layers `footage` do spec (o que o chamador precisa buscar). */
export function footageTakeIds(spec: SpecLike): string[] {
	const ids = new Set<string>();
	for (const scene of spec.scenes) for (const l of scene.layers) if (isFootage(l) && l.takeId) ids.add(l.takeId);

	return Array.from(ids);
}

/** O spec tem alguma layer `footage`? Sem nenhuma, `finalizeFootage` devolve o spec como veio. */
export function hasFootage(spec: SpecLike): boolean {
	return spec.scenes.some((s) => s.layers.some(isFootage));
}

/** Aceita `w` ou `word`; descarta palavra sem texto ou sem tempo válido (não quebra o resto). */
export function normalizeTake(t: FootageTakeInput): FootageTake {
	const words: TakeWord[] = [];
	for (const x of t.words ?? []) {
		const raw = x as { w?: unknown; word?: unknown; startMs?: unknown; endMs?: unknown };
		const w = typeof raw.w === "string" ? raw.w : typeof raw.word === "string" ? raw.word : null;
		if (w === null || typeof raw.startMs !== "number" || typeof raw.endMs !== "number") continue;
		if (!Number.isFinite(raw.startMs) || !Number.isFinite(raw.endMs)) continue;
		words.push({ w, startMs: raw.startMs, endMs: raw.endMs });
	}

	return { id: String(t.id), src: typeof t.src === "string" && t.src ? t.src : null, durationMs: Number(t.durationMs) || 0, words };
}

/** Palavra que contém o instante `ms`, se houver. */
const wordAt = (words: TakeWord[], ms: number): TakeWord | undefined => words.find((w) => ms > w.startMs && ms < w.endMs);

/**
 * Corrige entrada/saída de um clipe de cena inteira (o caso normal: cena = 1 clipe).
 * Corte que cai no meio de uma palavra: a palavra fica se a maior parte dela está dentro do
 * trecho, sai se não — esticar sempre traria de volta a palavra que quem editou quis tirar.
 */
function snapClip(scene: SceneLike, layer: FootageLayer, take: FootageTake): void {
	let inMs = layer.startFromMs ?? 0;
	let outMs = inMs + scene.durationMs;
	const words = take.words;

	const cutIn = wordAt(words, inMs);
	if (cutIn) {
		// A folga antes da palavra nunca invade a anterior — senão a próxima passada (roda a cada
		// alteração) cai dentro dela e o corte anda sozinho.
		const before = words.filter((w) => w.endMs <= cutIn.startMs);
		const prev = before[before.length - 1];
		inMs = inMs - cutIn.startMs <= cutIn.endMs - inMs ? Math.max(prev?.endMs ?? 0, cutIn.startMs - LEAD_MS) : cutIn.endMs;
	}

	const cutOut = wordAt(words, outMs);
	if (cutOut) {
		if (outMs - cutOut.startMs >= cutOut.endMs - outMs) {
			// Fica: folga depois dela, sem encostar no começo da próxima.
			const next = words.find((w) => w.startMs >= cutOut.endMs);
			outMs = Math.min(cutOut.endMs + TAIL_MS, next ? next.startMs - 20 : Infinity);
		} else {
			outMs = cutOut.startMs - 20;
		}
	}

	outMs = Math.min(outMs, take.durationMs);
	inMs = Math.min(inMs, Math.max(0, outMs - MIN_CLIP_MS));

	layer.startFromMs = Math.round(inMs);
	scene.durationMs = Math.max(MIN_CLIP_MS, Math.round(outMs - inMs));
}

const clean = (w: string): string => w.replace(/^[,.;:!?…"“”]+|[,.;…"“”]+$/g, "");

export interface AutoCaptionLayer {
	type: "karaoke";
	auto: true;
	text: string;
	startMs: number;
	durationMs: number;
	wordEndsMs: number[];
}

/** Blocos de legenda de um clipe: até `maxWords`, quebrando em pausa ou fim de frase. */
export function captionLayers(words: TakeWord[], inMs: number, sceneMs: number, maxWords: number): AutoCaptionLayer[] {
	const inside = words
		// Só entra na legenda a palavra que está MAJORITARIAMENTE dentro do clipe — a sobra de
		// 60ms de uma palavra cortada não é "fala" e repetiria na cena vizinha.
		.filter((w) => Math.min(w.endMs, inMs + sceneMs) - Math.max(w.startMs, inMs) >= Math.max(1, w.endMs - w.startMs) / 2)
		.map((w) => ({ text: clean(w.w), start: Math.max(0, w.startMs - inMs), end: Math.min(sceneMs, w.endMs - inMs), raw: w.w }))
		.filter((w) => w.text);

	const blocks: (typeof inside)[] = [];
	let cur: typeof inside = [];
	inside.forEach((w, i) => {
		cur.push(w);
		const next = inside[i + 1];
		const endsSentence = /[.!?…]$/.test(w.raw);
		if (!next || cur.length >= maxWords || endsSentence || next.start - w.end > GAP_BREAK_MS) {
			blocks.push(cur);
			cur = [];
		}
	});

	return blocks.map((b, i) => {
		const last = b[b.length - 1];
		const start = Math.round(b[0].start);
		// O bloco fica na tela até o próximo começar (sem piscar entre palavras próximas).
		const nextStart = blocks[i + 1]?.[0].start;
		const end = Math.round(nextStart !== undefined && nextStart - last.end < GAP_BREAK_MS ? nextStart : last.end + 150);

		return {
			type: "karaoke",
			auto: true,
			text: b.map((w) => w.text).join(" "),
			startMs: start,
			durationMs: Math.max(200, Math.min(sceneMs - start, end - start)),
			wordEndsMs: b.map((w) => Math.max(1, Math.round(w.end - start))),
		};
	});
}

/** Refaz o `startMs` das cenas em sequência (sem buraco nem sobreposição). */
function reflow(spec: SpecLike): number {
	let cursor = 0;
	for (const scene of spec.scenes) {
		scene.startMs = cursor;
		cursor += scene.durationMs;
	}

	return cursor;
}

/**
 * Aplica o acabamento e devolve um spec NOVO (a entrada não é tocada), já com reflow.
 *
 * Casamento layer → take: por `takeId` (e então o `src` da layer passa a ser o do take — a URL
 * vem de quem tem o arquivo, não de quem editou: um caractere trocado no src = cena preta); a
 * layer sem `takeId` casa pelo `src` igual ao de um take. Sem nenhuma layer `footage`, o spec
 * volta como veio (specs de anúncio seguem iguais).
 */
export function finalizeFootage<S extends SpecLike>(input: S, takesIn: readonly FootageTakeInput[]): FinalizeFootageResult<S> {
	const spec = JSON.parse(JSON.stringify(input)) as S;
	const warnings: string[] = [];
	if (!Array.isArray(spec.scenes)) return { spec, warnings: ["spec sem scenes"], stats: { clips: 0, captionBlocks: 0, durationMs: 0 } };
	if (!hasFootage(spec)) {
		const durationMs = spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);

		return { spec, warnings, stats: { clips: 0, captionBlocks: 0, durationMs } };
	}

	const takes = takesIn.map(normalizeTake).filter((t) => t.durationMs > 0);
	const byId = new Map(takes.map((t) => [t.id, t]));
	const bySrc = new Map(takes.filter((t) => t.src).map((t) => [t.src as string, t]));
	const takeOf = (l: FootageLayer): FootageTake | undefined => (l.takeId ? byId.get(l.takeId) : undefined) ?? bySrc.get(l.src);

	const auto = (spec.autoCaptions ?? { enabled: true }) as { enabled?: boolean; maxWords?: number };
	const captionsOn = auto.enabled !== false;
	const maxWords = auto.maxWords ?? 4;

	const mains: { scene: SceneLike; layer: FootageLayer; take: FootageTake }[] = [];
	for (const scene of spec.scenes) {
		for (const l of scene.layers) {
			if (!isFootage(l)) continue;
			const byTakeId = l.takeId ? byId.get(l.takeId) : undefined;
			if (byTakeId?.src) l.src = byTakeId.src;
			if (typeof l.startFromMs === "number") l.startFromMs = Math.max(0, Math.round(l.startFromMs));
		}

		// Legendas automáticas antigas saem sempre; voltam refeitas logo abaixo.
		scene.layers = scene.layers.filter((l) => !isAutoCaption(l));

		// O clipe "dono" da cena: o primeiro footage de cena inteira. É ele que define a duração.
		const main = scene.layers.find((l): l is FootageLayer => isFootage(l) && !l.startMs && !l.durationMs);
		if (!main) continue;
		const take = takeOf(main);
		if (!take) {
			warnings.push(`cena ${scene.id}: take ${main.takeId ? `"${main.takeId}"` : `"${main.src}"`} desconhecido — clipe sem acabamento`);
			continue;
		}
		if (!take.words.length) warnings.push(`cena ${scene.id}: take "${take.id}" sem transcrição — sem legenda da fala`);

		snapClip(scene, main, take);
		mains.push({ scene, layer: main, take });
	}

	// Dois clipes seguidos do mesmo take não podem se sobrepor: a fala tocaria duas vezes.
	for (let i = 0; i + 1 < mains.length; i++) {
		const a = mains[i];
		const b = mains[i + 1];
		if (a.take !== b.take || spec.scenes.indexOf(b.scene) !== spec.scenes.indexOf(a.scene) + 1) continue;
		const aIn = a.layer.startFromMs ?? 0;
		const bIn = b.layer.startFromMs ?? 0;
		if (bIn >= aIn && aIn + a.scene.durationMs > bIn) a.scene.durationMs = Math.max(MIN_CLIP_MS, bIn - aIn);
	}

	let captionBlocks = 0;
	for (const { scene, layer, take } of mains) {
		if (captionsOn && (layer.volume ?? 1) > 0 && take.words.length) {
			const caps = captionLayers(take.words, layer.startFromMs ?? 0, scene.durationMs, maxWords);
			scene.layers.push(...caps);
			captionBlocks += caps.length;
		}
	}

	if (!spec.autoCaptions) (spec as SpecLike).autoCaptions = { enabled: true, maxWords };
	const durationMs = reflow(spec);

	return { spec, warnings, stats: { clips: mains.length, captionBlocks, durationMs } };
}
