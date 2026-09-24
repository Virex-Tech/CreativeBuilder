import { finalizeFootage as finalizeWithTakes, footageTakeIds, type FootageTakeInput } from "@/lib/engine/footage";
import { prisma } from "@/lib/prisma";
import type { Spec } from "@/lib/spec";
import { publicAssetUrl, type Transcript } from "@/lib/takes";

/**
 * Acabamento de um spec feito de takes, rodado depois de TODA edição da IA (e de todo ajuste):
 * corte na fronteira de palavra, sem fala dobrada entre clipes do mesmo take e legenda refeita da
 * fala real.
 *
 * A lógica NÃO mora aqui: é a implementação única do engine (`render/src/footage.ts`), espelhada
 * em `./engine/footage.ts` por `npm run build:lib` em render/ (o build Docker do servidor só vê
 * server/). Este arquivo só faz a parte que depende do banco: buscar os takes citados.
 */

export { footageTakeIds };

async function loadTakes(ids: string[]): Promise<FootageTakeInput[]> {
	const rows = await prisma.take.findMany({ where: { id: { in: ids } } });
	const takes: FootageTakeInput[] = [];
	for (const t of rows) {
		if (!t.durationMs) continue;
		takes.push({ id: t.id, src: publicAssetUrl(t.file), durationMs: t.durationMs, words: (t.transcript as Transcript | null)?.words ?? [] });
	}

	return takes;
}

/**
 * Aplica o acabamento. Devolve o spec novo já com reflow. Sem camadas `footage` com take
 * conhecido, não mexe em nada — specs de anúncio seguem iguais.
 */
export async function finalizeFootage(spec: Spec): Promise<Spec> {
	const ids = footageTakeIds(spec);
	if (ids.length === 0) return spec;

	return finalizeWithTakes(spec, await loadTakes(ids)).spec;
}
