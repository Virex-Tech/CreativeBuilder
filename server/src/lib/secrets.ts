import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Tokens de terceiros (Instagram) ficam cifrados no banco com AES-256-GCM. A chave deriva do
 * JWT_SECRET — um segredo a menos pra gerenciar; trocar o JWT_SECRET exige reconectar as contas.
 */
const key = (): Buffer => createHash("sha256").update(`token-enc:${env.JWT_SECRET}`).digest();

export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

	return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string): string {
	const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
	const decipher = createDecipheriv("aes-256-gcm", key(), iv);
	decipher.setAuthTag(tag);

	return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** `state` assinado do OAuth: carrega um valor curto e expira em 15 min. */
export function signState(value: string): string {
	const payload = Buffer.from(JSON.stringify({ v: value, ts: Date.now() })).toString("base64url");
	const sig = createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");

	return `${payload}.${sig}`;
}

export function verifyState(state: string | undefined): string | null {
	if (!state) return null;
	const [payload, sig] = state.split(".");
	if (!payload || !sig) return null;
	const expected = createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
	if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v: string; ts: number };

		return Date.now() - parsed.ts < 15 * 60 * 1000 ? parsed.v : null;
	} catch {
		return null;
	}
}
