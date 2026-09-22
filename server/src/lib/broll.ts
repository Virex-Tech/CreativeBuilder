import { env } from "@/lib/env";
import { generateVideo as higgsGenerate, higgsfieldEnabled } from "@/lib/higgsfield";
import { generateVideo as kieGenerate, kieEnabled } from "@/lib/kie";

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
