import type { SocialAccount } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/secrets";

/**
 * Publicação de Reels pela API do Instagram com login do Instagram (graph.instagram.com).
 *
 * Não precisa de Página do Facebook: a conta só precisa ser Profissional (Criador ou Empresa).
 * O fluxo de publicar é em 3 passos e o do meio é assíncrono — o Instagram baixa o MP4 da
 * nossa URL pública e processa:
 *   1. POST /{ig}/media  (REELS + video_url + caption)   → container
 *   2. GET  /{container}?fields=status_code               → até FINISHED
 *   3. POST /{ig}/media_publish (creation_id)             → id do post
 * O laço do estúdio faz um passo por volta e guarda o container, então um restart no meio não
 * sobe o vídeo duas vezes.
 *
 * Conectar: OAuth (se INSTAGRAM_APP_ID/SECRET estão no servidor) ou colando um token gerado no
 * painel da Meta (Instagram → "Gerar token"). Os dois viram um token de longa duração (60 dias),
 * renovado sozinho pelo laço.
 */

const GRAPH = (): string => `https://graph.instagram.com/${env.INSTAGRAM_API_VERSION}`;

export const oauthEnabled = (): boolean => Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);

export const redirectUri = (): string => `${env.PUBLIC_API_BASE.replace(/\/$/, "")}/studio/instagram/callback`;

export function authorizeUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: env.INSTAGRAM_APP_ID as string,
		redirect_uri: redirectUri(),
		scope: "instagram_business_basic,instagram_business_content_publish",
		response_type: "code",
		state,
	});

	return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

interface GraphError {
	error?: { message?: string; code?: number; error_user_msg?: string };
	error_message?: string;
}

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path.startsWith("http") ? path : `${GRAPH()}${path}`, init);
	const body = (await res.json().catch(() => ({}))) as T & GraphError;
	if (!res.ok || body.error) {
		const msg = body.error?.error_user_msg ?? body.error?.message ?? body.error_message ?? `HTTP ${res.status}`;
		throw new Error(`Instagram: ${msg}`);
	}

	return body;
}

/** code do OAuth → token curto → token longo. */
export async function exchangeCode(code: string): Promise<string> {
	const form = new URLSearchParams({
		client_id: env.INSTAGRAM_APP_ID as string,
		client_secret: env.INSTAGRAM_APP_SECRET as string,
		grant_type: "authorization_code",
		redirect_uri: redirectUri(),
		code,
	});
	const short = await graph<{ access_token: string }>("https://api.instagram.com/oauth/access_token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: form.toString(),
	});

	return short.access_token;
}

/** Troca por um token de 60 dias. Se já for longo (ou não houver app secret), usa como veio. */
async function toLongLived(token: string): Promise<{ token: string; expiresIn: number | null }> {
	if (!env.INSTAGRAM_APP_SECRET) return { token, expiresIn: null };
	try {
		const out = await graph<{ access_token: string; expires_in: number }>(
			`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.INSTAGRAM_APP_SECRET)}&access_token=${encodeURIComponent(token)}`,
		);

		return { token: out.access_token, expiresIn: out.expires_in };
	} catch {
		return { token, expiresIn: null };
	}
}

export interface IgProfile {
	user_id: string;
	username: string;
	profile_picture_url?: string;
	account_type?: string;
}

export async function profile(token: string): Promise<IgProfile> {
	return graph<IgProfile>(`/me?fields=user_id,username,profile_picture_url,account_type&access_token=${encodeURIComponent(token)}`);
}

/** Guarda o token (cifrado) na conta, depois de conferir com /me de quem ele é. */
export async function connectAccount(accountId: string, rawToken: string): Promise<SocialAccount> {
	const { token, expiresIn } = await toLongLived(rawToken.trim());
	const me = await profile(token);

	return prisma.socialAccount.update({
		where: { id: accountId },
		data: {
			igUserId: me.user_id,
			igUsername: me.username,
			avatarUrl: me.profile_picture_url ?? undefined,
			accessTokenEnc: encrypt(token),
			// Token colado sem app secret: não dá pra saber a validade; assume 60 dias.
			tokenExpiresAt: new Date(Date.now() + (expiresIn ?? 60 * 24 * 3600) * 1000),
			connectedAt: new Date(),
		},
	});
}

export function accountToken(account: SocialAccount): string {
	if (!account.accessTokenEnc || !account.igUserId) throw new Error("conta do Instagram não conectada");

	return decrypt(account.accessTokenEnc);
}

export const isConnected = (a: Pick<SocialAccount, "platform" | "igUserId" | "accessTokenEnc">): boolean =>
	a.platform === "INSTAGRAM" && Boolean(a.igUserId && a.accessTokenEnc);

/** Renova tokens a menos de 10 dias de vencer. Token de 60 dias só renova depois de 24h de vida. */
export async function refreshExpiringTokens(): Promise<void> {
	const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000);
	const rows = await prisma.socialAccount.findMany({
		where: { accessTokenEnc: { not: null }, tokenExpiresAt: { lt: soon } },
	});
	for (const account of rows) {
		try {
			const out = await graph<{ access_token: string; expires_in: number }>(
				`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accountToken(account))}`,
			);
			await prisma.socialAccount.update({
				where: { id: account.id },
				data: { accessTokenEnc: encrypt(out.access_token), tokenExpiresAt: new Date(Date.now() + out.expires_in * 1000) },
			});
		} catch {
			// Sem renovar, a publicação falha com a mensagem do Instagram e a tela pede reconexão.
		}
	}
}

export async function createReelContainer(account: SocialAccount, videoUrl: string, caption: string): Promise<string> {
	const form = new URLSearchParams({
		media_type: "REELS",
		video_url: videoUrl,
		caption,
		share_to_feed: "true",
		access_token: accountToken(account),
	});
	const out = await graph<{ id: string }>(`/${account.igUserId}/media`, { method: "POST", body: form });

	return out.id;
}

/** IN_PROGRESS | FINISHED | ERROR | EXPIRED | PUBLISHED */
export async function containerStatus(account: SocialAccount, containerId: string): Promise<{ status: string; detail?: string }> {
	const out = await graph<{ status_code: string; status?: string }>(
		`/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accountToken(account))}`,
	);

	return { status: out.status_code, detail: out.status };
}

export async function publishContainer(account: SocialAccount, containerId: string): Promise<{ id: string; permalink: string | null }> {
	const token = accountToken(account);
	const out = await graph<{ id: string }>(`/${account.igUserId}/media_publish`, {
		method: "POST",
		body: new URLSearchParams({ creation_id: containerId, access_token: token }),
	});
	let permalink: string | null = null;
	try {
		permalink = (await graph<{ permalink?: string }>(`/${out.id}?fields=permalink&access_token=${encodeURIComponent(token)}`)).permalink ?? null;
	} catch {
		// o post existe; o link é só conveniência
	}

	return { id: out.id, permalink };
}
