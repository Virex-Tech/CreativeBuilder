import { downloadAsset } from "@/lib/assets";
import { env } from "@/lib/env";
import { generateVideo as higgsGenerate, higgsfieldEnabled } from "@/lib/higgsfield";
import { generateVideo as kieGenerate, kieEnabled } from "@/lib/kie";
import { prisma } from "@/lib/prisma";
import { reflow, specHash, type Spec } from "@/lib/spec";

/**
 * Camada única de b-roll — abstrai o provedor (Higgsfield ou kie.ai). A plataforma escolhe
 * qual usar por requisição; se nenhum for pedido, cai no BROLL_PROVIDER (default) e, se esse
 * não estiver configurado, no primeiro provedor habilitado. Cada provedor é "inerte" sem as
 * suas credenciais — daí `enabledProviders()` para a UI só oferecer o que dá pra usar.
 */

export const BROLL_PROVIDERS = ["higgsfield", "kie"] as const;
export type BrollProvider = (typeof BROLL_PROVIDERS)[number];

export function isBrollProvider(v: unknown): v is BrollProvider {
	return typeof v === "string" && (BROLL_PROVIDERS as readonly string[]).includes(v);
}

export function providerEnabled(p: BrollProvider): boolean {
	return p === "kie" ? kieEnabled() : higgsfieldEnabled();
}

export function enabledProviders(): BrollProvider[] {
	return BROLL_PROVIDERS.filter(providerEnabled);
}

/**
 * Resolve o provedor efetivo: o pedido (se habilitado) → BROLL_PROVIDER (se habilitado) →
 * primeiro habilitado. Devolve null quando nenhum provedor está configurado.
 */
export function resolveProvider(requested?: string | null): BrollProvider | null {
	if (isBrollProvider(requested) && providerEnabled(requested)) return requested;
	if (providerEnabled(env.BROLL_PROVIDER)) return env.BROLL_PROVIDER;

	return enabledProviders()[0] ?? null;
}

export async function generateVideo(
	provider: BrollProvider,
	prompt: string,
): Promise<{ url: string; requestId: string }> {
	return provider === "kie" ? kieGenerate(prompt) : higgsGenerate(prompt);
}

interface GenerativeLayer {
	type: string;
	prompt?: string;
	src?: string;
	[key: string]: unknown;
}

/** Camadas `generative_video` com prompt e ainda sem `src` — o que falta gerar. */
export function pendingBrollLayers(spec: Spec): GenerativeLayer[] {
	const pending: GenerativeLayer[] = [];
	for (const scene of spec.scenes) {
		for (const raw of scene.layers) {
			const layer = raw as GenerativeLayer;
			if (layer.type === "generative_video" && layer.prompt && !layer.src) pending.push(layer);
		}
	}

	return pending;
}

/** Teto por chamada: cada geração custa créditos e ~45s; evita loop absurdo. */
const MAX_PER_RUN = 6;

export type FillBrollResult =
	| { unchanged: true; generated: 0; pending: 0 }
	| {
			unchanged: false;
			version: Awaited<ReturnType<typeof prisma.creativeVersion.create>>;
			generated: number;
			pending: number;
			truncated: boolean;
	  };

/**
 * Gera o b-roll de todas as camadas `generative_video` pendentes (sem `src`) do criativo,
 * preenche o `src` e grava uma nova versão do spec.
 *
 * A URL do provedor pode expirar — por isso baixamos o asset pra /media e servimos por uma
 * URL local que não expira (quando PUBLIC_API_BASE está setado). Sequencial de propósito.
 * Se já gerou alguma e a seguinte falha, salva o progresso (créditos não se perdem); se a
 * primeira falha, propaga o erro.
 */
export async function fillPendingBroll(creativeId: string, provider: BrollProvider): Promise<FillBrollResult> {
	const current = await prisma.creativeVersion.findFirst({
		where: { creativeId },
		orderBy: { version: "desc" },
	});
	if (!current) throw new Error("criativo sem versão");

	const spec = current.spec as unknown as Spec;
	const pending = pendingBrollLayers(spec);
	if (pending.length === 0) return { unchanged: true, generated: 0, pending: 0 };

	let generated = 0;
	try {
		for (const layer of pending.slice(0, MAX_PER_RUN)) {
			const out = await generateVideo(provider, layer.prompt as string);
			// Baixa o asset pra /media e usa a URL local (não expira). Se o download ou o
			// PUBLIC_API_BASE não estiverem disponíveis, cai na URL do provedor.
			let src = out.url;
			try {
				const saved = await downloadAsset(out.url);
				if (saved.publicUrl) src = saved.publicUrl;
			} catch {
				// mantém a URL do provedor
			}
			layer.src = src;
			layer.provider = provider;
			generated++;
		}
	} catch (err) {
		if (generated === 0) throw err;
	}

	const next = reflow(spec);
	const version = await prisma.creativeVersion.create({
		data: {
			creativeId,
			version: current.version + 1,
			spec: next as object,
			specHash: specHash(next),
			createdBy: "ai",
			note: `b-roll ${provider} (${generated}/${pending.length})`,
		},
	});

	return { unchanged: false, version, generated, pending: pending.length, truncated: pending.length > MAX_PER_RUN };
}
