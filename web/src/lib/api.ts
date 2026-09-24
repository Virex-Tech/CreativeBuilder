/**
 * Thin client for api.
 *
 * The token lives in localStorage: this is an internal tool behind the team's own network,
 * and a cookie/refresh dance would be ceremony without a threat it defends against here.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:11200";
const TOKEN_KEY = "creativebuilder.token";

export function getToken(): string | null {
	if (typeof window === "undefined") return null;

	return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public detail?: unknown,
	) {
		super(message);
	}
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const token = getToken();
	const res = await fetch(`${BASE}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...init?.headers,
		},
	});

	if (res.status === 401 && typeof window !== "undefined") {
		clearToken();
		window.location.href = "/login";
		throw new ApiError(401, "sessão expirada");
	}

	const text = await res.text();
	const body: unknown = text ? JSON.parse(text) : null;

	if (!res.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? String((body as { error: unknown }).error)
				: `HTTP ${res.status}`;
		throw new ApiError(res.status, message, body);
	}

	return body as T;
}

export const fileUrl = (renderJobId: string): string =>
	`${BASE}/render-jobs/${renderJobId}/file`;

/**
 * Upload multipart com progresso (fetch não expõe progresso de envio). Um arquivo por chamada:
 * take de celular é grande, e um por vez deixa cada barra honesta e cada falha isolada.
 */
export function uploadFile<T>(
	path: string,
	file: File,
	onProgress?: (pct: number) => void,
	opts: { auth?: boolean } = { auth: true },
): Promise<T> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${BASE}${path}`);
		const token = opts.auth === false ? null : getToken();
		if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () => {
			let body: unknown = null;
			try {
				body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
			} catch {
				// resposta não-JSON (nginx 413, por ex.)
			}
			if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
			const msg =
				body && typeof body === "object" && "error" in body
					? String((body as { error: unknown }).error)
					: xhr.status === 413
						? "arquivo grande demais pro servidor"
						: `HTTP ${xhr.status}`;
			reject(new ApiError(xhr.status, msg, body));
		};
		xhr.onerror = () => reject(new ApiError(0, "conexão caiu durante o envio"));
		const form = new FormData();
		form.append("file", file, file.name);
		xhr.send(form);
	});
}
