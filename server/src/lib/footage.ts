import { prisma } from "@/lib/prisma";
import { reflow, type Spec, type SpecScene } from "@/lib/spec";
import { publicAssetUrl, type Transcript, type Word } from "@/lib/takes";

/**
 * Acabamento determinístico de um spec feito de takes, rodado depois de TODA edição da IA
 * (e de todo ajuste): a IA escolhe os trechos, o servidor garante o que ela erra.
 *
 *  1. Corte limpo — o ponto de entrada/saída de cada clipe é puxado pra fronteira de palavra
 *     (um corte no meio de "treino" é o erro que mais denuncia edição automática) e nunca passa
 *     do fim do take.
 *  2. Legenda da fala real — as legendas `karaoke` com `auto: true` são jogadas fora e refeitas
 *     a partir da transcrição de cada clipe, em blocos curtos, com o tempo exato de cada palavra.
 *     A IA nunca escreve a legenda: se escrevesse, ela sairia do sincronismo no primeiro ajuste.
 */

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

interface TakeInfo {
	durationMs: number;
	words: Word[];
	src: string | null;
}

/** Folga antes da 1ª palavra e depois da última: corte colado na sílaba soa cortado. */
const LEAD_MS = 60;
const TAIL_MS = 120;
/** Pausa que quebra o bloco de legenda mesmo antes de encher. */
const GAP_BREAK_MS = 350;

const isFootage = (l: unknown): l is FootageLayer =>
	!!l && typeof l === "object" && (l as { type?: string }).type === "footage";

export function footageTakeIds(spec: Spec): string[] {
	const ids = new Set<string>();
	for (const scene of spec.scenes) for (const l of scene.layers) if (isFootage(l) && l.takeId) ids.add(l.takeId);

	return [...ids];
}

async function loadTakes(ids: string[]): Promise<Map<string, TakeInfo>> {
	const rows = await prisma.take.findMany({ where: { id: { in: ids } } });

	return new Map(
		rows
			.filter((t) => t.durationMs)
			.map((t) => [
				t.id,
				{ durationMs: t.durationMs as number, words: (t.transcript as Transcript | null)?.words ?? [], src: publicAssetUrl(t.file) },
			]),
	);
}

/** Palavra que contém o instante `ms`, se houver. */
const wordAt = (words: Word[], ms: number): Word | undefined => words.find((w) => ms > w.startMs && ms < w.endMs);

/**
 * Corrige entrada/saída de um clipe de cena inteira (o caso normal: cena = 1 clipe).
 * Corte que cai no meio de uma palavra: a palavra fica se a maior parte dela está dentro do
 * trecho, sai se não — esticar sempre traria de volta a palavra que a IA quis tirar.
 */
function snapClip(scene: SpecScene, layer: FootageLayer, take: TakeInfo): void {
	let inMs = layer.startFromMs ?? 0;
	let outMs = inMs + scene.durationMs;
	const words = take.words;

	const cutIn = wordAt(words, inMs);
	if (cutIn) {
		// A folga antes da palavra nunca invade a anterior — senão a próxima passada (roda a cada
		// alteração) cai dentro dela e o corte anda sozinho.
		const prev = words.filter((w) => w.endMs <= cutIn.startMs).at(-1);
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
	inMs = Math.min(inMs, Math.max(0, outMs - 300));

	layer.startFromMs = Math.round(inMs);
	scene.durationMs = Math.max(300, Math.round(outMs - inMs));
}

const clean = (w: string): string => w.replace(/^[,.;:!?…"“”]+|[,.;…"“”]+$/g, "");

/** Blocos de legenda de um clipe: até `maxWords`, quebrando em pausa ou fim de frase. */
function captionLayers(words: Word[], inMs: number, sceneMs: number, maxWords: number): Record<string, unknown>[] {
	const inside = words
		// Só entra na legenda a palavra que está MAJORITARIAMENTE dentro do clipe — a sobra de
		// 60ms de uma palavra cortada não é "fala" e repetiria na cena vizinha.
		.filter((w) => Math.min(w.endMs, inMs + sceneMs) - Math.max(w.startMs, inMs) >= Math.max(1, w.endMs - w.startMs) / 2)
		.map((w) => ({ text: clean(w.word), start: Math.max(0, w.startMs - inMs), end: Math.min(sceneMs, w.endMs - inMs), raw: w.word }))
		.filter((w) => w.text);

	const blocks: (typeof inside)[] = [];
	let cur: typeof inside = [];
	for (const [i, w] of inside.entries()) {
		cur.push(w);
		const next = inside[i + 1];
		const endsSentence = /[.!?…]$/.test(w.raw);
		if (!next || cur.length >= maxWords || endsSentence || next.start - w.end > GAP_BREAK_MS) {
			blocks.push(cur);
			cur = [];
		}
	}

	return blocks.map((b, i) => {
		const start = Math.round(b[0].start);
		// O bloco fica na tela até o próximo começar (sem piscar entre palavras próximas).
		const nextStart = blocks[i + 1]?.[0].start;
		const end = Math.round(nextStart !== undefined && nextStart - b[b.length - 1].end < GAP_BREAK_MS ? nextStart : b[b.length - 1].end + 150);
		const durationMs = Math.max(200, Math.min(sceneMs - start, end - start));

		return {
			type: "karaoke",
			auto: true,
			text: b.map((w) => w.text).join(" "),
			startMs: start,
			durationMs,
			wordEndsMs: b.map((w) => Math.max(1, Math.round(w.end - start))),
		};
	});
}

/**
 * Aplica o acabamento. Devolve o mesmo spec (mutado) já com reflow. Sem camadas `footage` com
 * take conhecido, não mexe em nada — specs de anúncio seguem iguais.
 */
export async function finalizeFootage(spec: Spec): Promise<Spec> {
	const ids = footageTakeIds(spec);
	if (ids.length === 0) return spec;
	const takes = await loadTakes(ids);

	const auto = (spec.autoCaptions ?? { enabled: true }) as { enabled?: boolean; maxWords?: number };
	const captionsOn = auto.enabled !== false;
	const maxWords = auto.maxWords ?? 4;

	const mains: { scene: SpecScene; layer: FootageLayer; take: TakeInfo }[] = [];
	for (const scene of spec.scenes) {
		// A URL do take vem do banco, não da IA: um caractere trocado no src = cena preta.
		for (const l of scene.layers) {
			if (!isFootage(l) || !l.takeId) continue;
			const src = takes.get(l.takeId)?.src;
			if (src) l.src = src;
			if (typeof l.startFromMs === "number") l.startFromMs = Math.max(0, Math.round(l.startFromMs));
		}

		// Legendas automáticas antigas saem sempre; voltam refeitas logo abaixo.
		scene.layers = scene.layers.filter((l) => !((l as { type?: string; auto?: boolean }).type === "karaoke" && (l as { auto?: boolean }).auto));

		// O clipe "dono" da cena: o primeiro footage de cena inteira. É ele que define a duração.
		const main = scene.layers.find((l): l is FootageLayer => isFootage(l) && !l.startMs && !l.durationMs);
		const take = main?.takeId ? takes.get(main.takeId) : undefined;
		if (!main || !take) continue;

		snapClip(scene, main, take);
		mains.push({ scene, layer: main, take });
	}

	// Dois clipes seguidos do mesmo take não podem se sobrepor: a fala tocaria duas vezes.
	for (let i = 0; i + 1 < mains.length; i++) {
		const a = mains[i];
		const b = mains[i + 1];
		if (a.layer.takeId !== b.layer.takeId || spec.scenes.indexOf(b.scene) !== spec.scenes.indexOf(a.scene) + 1) continue;
		const aIn = a.layer.startFromMs ?? 0;
		const bIn = b.layer.startFromMs ?? 0;
		if (bIn >= aIn && aIn + a.scene.durationMs > bIn) a.scene.durationMs = Math.max(300, bIn - aIn);
	}

	for (const { scene, layer, take } of mains) {
		if (captionsOn && (layer.volume ?? 1) > 0 && take.words.length) {
			scene.layers.push(...captionLayers(take.words, layer.startFromMs ?? 0, scene.durationMs, maxWords));
		}
	}

	if (!spec.autoCaptions) spec.autoCaptions = { enabled: true, maxWords };

	return reflow(spec);
}
