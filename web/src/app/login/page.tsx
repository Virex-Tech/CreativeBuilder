"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, setToken } from "@/lib/api";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const res = await api<{ token: string }>("/auth/login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			});
			setToken(res.token);
			router.push("/apps");
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha no login");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
			<form onSubmit={submit} className="panel stack" style={{ padding: 28, width: 360 }}>
				<h1 style={{ margin: 0, fontSize: 20 }}>Creative Engine</h1>
				<p className="muted" style={{ margin: 0 }}>Ferramenta interna. Peça acesso a um admin.</p>
				<input
					type="email"
					autoComplete="username"
					placeholder="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					type="password"
					autoComplete="current-password"
					placeholder="senha"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				{error ? <div style={{ color: "var(--danger)" }}>{error}</div> : null}
				<button className="primary" disabled={busy}>
					{busy ? "entrando..." : "entrar"}
				</button>
			</form>
		</main>
	);
}
