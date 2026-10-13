"use client";

import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";

/**
 * Painel admin para conectar a IA (Codex) por OAuth, sem CLI.
 *
 * Fluxo device-auth: clica "Conectar" → a API devolve um link + código de uso único → o admin
 * autoriza no navegador com a conta ChatGPT → o painel faz polling do status até "conectado".
 * Some para quem não é admin (a API responde 403 e a gente esconde).
 */

type Status = "connected" | "pending" | "disconnected";

interface StatusResp {
	provider: string;
	status: Status;
	device: { url: string; code: string } | null;
}

export function CodexConnect(): React.ReactElement | null {
	const [visible, setVisible] = useState(false);
	const [provider, setProvider] = useState<string>("codex");
	const [status, setStatus] = useState<Status>("disconnected");
	const [device, setDevice] = useState<{ url: string; code: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const poll = useRef<ReturnType<typeof setInterval> | null>(null);

	function stopPolling(): void {
		if (poll.current) {
			clearInterval(poll.current);
			poll.current = null;
		}
	}

	async function refresh(): Promise<void> {
		const r = await api<StatusResp>("/codex/status");
		setVisible(true);
		setProvider(r.provider);
		setStatus(r.status);
		setDevice(r.device);
		if (r.status === "connected") {
			stopPolling();
			setDevice(null);
		} else if (r.status === "pending" && !poll.current) {
			startPolling();
		}
	}

	function startPolling(): void {
		stopPolling();
		poll.current = setInterval(() => {
			void api<StatusResp>("/codex/status")
				.then((r) => {
					setStatus(r.status);
					if (r.status === "connected") {
						stopPolling();
						setDevice(null);
						setMsg("Codex conectado.");
					}
				})
				.catch(() => {});
		}, 3000);
	}

	useEffect(() => {
		void (async () => {
			try {
				await refresh();
			} catch (e) {
				// 403 = não é admin: esconde o painel. Outros erros ficam silenciosos aqui.
				if (e instanceof ApiError && e.status === 403) setVisible(false);
			}
		})();

		return stopPolling;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function connect(): Promise<void> {
		setBusy(true);
		setErr(null);
		setMsg(null);
		try {
			const r = await api<{ status: Status; url?: string; code?: string }>("/codex/login", {
				method: "POST",
				body: JSON.stringify({}),
			});
			if (r.status === "connected") {
				setStatus("connected");
			} else if (r.url && r.code) {
				setStatus("pending");
				setDevice({ url: r.url, code: r.code });
				startPolling();
			}
		} catch (e) {
			setErr(e instanceof Error ? e.message : "falha ao iniciar conexão");
		} finally {
			setBusy(false);
		}
	}

	async function test(): Promise<void> {
		setBusy(true);
		setErr(null);
		setMsg(null);
		try {
			const r = await api<{ ok: boolean; sample?: string }>("/codex/test", {
				method: "POST",
				body: JSON.stringify({}),
			});
			setMsg(r.ok ? `Teste OK — modelo respondeu: "${r.sample ?? ""}"` : "Teste falhou.");
		} catch (e) {
			setErr(e instanceof Error ? e.message : "falha no teste");
		} finally {
			setBusy(false);
		}
	}

	if (!visible) return null;

	const dot =
		status === "connected" ? "var(--accent, #b6ff3b)" : status === "pending" ? "#f2c94c" : "#888";
	const label =
		status === "connected" ? "conectado" : status === "pending" ? "aguardando autorização" : "desconectado";

	return (
		<div className="panel stack" style={{ padding: 16, marginTop: 16 }}>
			<div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
				<div className="row" style={{ gap: 8, alignItems: "center" }}>
					<span style={{ width: 10, height: 10, borderRadius: 999, background: dot, display: "inline-block" }} />
					<strong>IA (Codex)</strong>
					<span style={{ color: "#999", fontSize: 13 }}>· {label}</span>
				</div>
				<div className="row" style={{ gap: 8 }}>
					{status === "connected" ? (
						<button onClick={() => void test()} disabled={busy}>
							{busy ? "..." : "testar"}
						</button>
					) : (
						<button className="primary" onClick={() => void connect()} disabled={busy || provider !== "codex"}>
							{busy ? "..." : status === "pending" ? "reabrir código" : "conectar Codex"}
						</button>
					)}
				</div>
			</div>

			{provider !== "codex" ? (
				<p style={{ color: "#999", fontSize: 13, margin: 0 }}>
					Provider ativo é <code>{provider}</code>. Para usar o Codex, defina <code>AI_PROVIDER=codex</code> no servidor.
				</p>
			) : null}

			{status === "pending" && device ? (
				<div className="stack" style={{ gap: 6 }}>
					<p style={{ margin: 0, fontSize: 14 }}>
						1) Abra{" "}
						<a href={device.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent, #b6ff3b)" }}>
							{device.url}
						</a>{" "}
						e entre com a conta ChatGPT.
					</p>
					<p style={{ margin: 0, fontSize: 14 }}>2) Digite este código:</p>
					<code style={{ fontSize: 22, letterSpacing: 2, padding: "6px 10px", background: "#0003", borderRadius: 8, width: "fit-content" }}>
						{device.code}
					</code>
					<p style={{ margin: 0, color: "#999", fontSize: 12 }}>O código expira em ~15 min. Assim que você autorizar, isto vira “conectado” sozinho.</p>
				</div>
			) : null}

			{status === "disconnected" ? (
				<p style={{ color: "#999", fontSize: 13, margin: 0 }}>
					Sem conexão, os recursos de IA (gerar/ajustar criativo, diagnóstico de métricas) ficam indisponíveis. É uma configuração do servidor: conecta uma vez, vale pra todos.
				</p>
			) : null}

			{msg ? <p style={{ color: "var(--accent, #b6ff3b)", fontSize: 13, margin: 0 }}>{msg}</p> : null}
			{err ? <p style={{ color: "var(--danger, #ff6b6b)", fontSize: 13, margin: 0 }}>{err}</p> : null}
		</div>
	);
}
