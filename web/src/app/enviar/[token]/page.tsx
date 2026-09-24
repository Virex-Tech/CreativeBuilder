"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { uploadFile } from "@/lib/api";
import { spDate, spTime } from "@/lib/studio";

/**
 * Link de envio (sem login): o criador abre no celular e sobe os takes da postagem. O token
 * na URL é o único acesso — só permite ver o @/título/horário e mandar vídeo pra ESTA postagem.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:11200";

interface Info {
	handle: string;
	title: string | null;
	scheduledAt: string;
	takes: { id: string; name: string | null; status: string; createdAt: string }[];
}

interface Item {
	name: string;
	pct: number;
	done?: boolean;
	error?: string;
}

export default function SendTakes() {
	const { token } = useParams<{ token: string }>();
	const [info, setInfo] = useState<Info | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<Item[]>([]);
	const [sending, setSending] = useState(false);

	const load = useCallback(async () => {
		const res = await fetch(`${BASE}/public/send/${token}`);
		if (!res.ok) throw new Error(res.status === 404 ? "Este link não existe mais." : `Erro ${res.status}`);
		setInfo((await res.json()) as Info);
	}, [token]);

	useEffect(() => {
		void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "falhou"));
	}, [load]);

	async function send(files: FileList) {
		const list = Array.from(files);
		const start = items.length;
		setItems((cur) => [...cur, ...list.map((f) => ({ name: f.name, pct: 0 }))]);
		setSending(true);
		for (const [i, f] of list.entries()) {
			const at = start + i;
			try {
				await uploadFile(`/public/send/${token}`, f, (pct) => setItems((cur) => cur.map((x, j) => (j === at ? { ...x, pct } : x))), { auth: false });
				setItems((cur) => cur.map((x, j) => (j === at ? { ...x, pct: 100, done: true } : x)));
			} catch (e) {
				setItems((cur) => cur.map((x, j) => (j === at ? { ...x, error: e instanceof Error ? e.message : "falhou" } : x)));
			}
		}
		setSending(false);
		void load().catch(() => undefined);
	}

	return (
		<main style={{ maxWidth: 520, margin: "0 auto", padding: "28px 18px 60px" }} className="stack">
			<div style={{ fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>ENVIAR TAKES</div>
			{error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
			{!info && !error ? <p className="muted">carregando…</p> : null}
			{info ? (
				<>
					<div>
						<h1 style={{ fontSize: 24, margin: "4px 0" }}>@{info.handle}</h1>
						<div className="muted">
							{info.title ? `${info.title} · ` : ""}
							{spDate(new Date(info.scheduledAt)).split("-").reverse().join("/")} às {spTime(info.scheduledAt)}
						</div>
					</div>

					<label
						className="panel stack"
						style={{ padding: 28, alignItems: "center", textAlign: "center", cursor: sending ? "wait" : "pointer", borderStyle: "dashed", borderColor: "var(--accent)", gap: 6 }}
					>
						<span style={{ fontSize: 34 }}>🎬</span>
						<strong>{sending ? "enviando…" : "escolher vídeos"}</strong>
						<span className="muted" style={{ fontSize: 12 }}>pode mandar vários de uma vez · mantenha esta tela aberta até terminar</span>
						<input type="file" accept="video/*" multiple hidden disabled={sending} onChange={(e) => e.target.files?.length && void send(e.target.files)} />
					</label>

					{items.map((it, i) => (
						<div key={`${it.name}-${String(i)}`} className="stack" style={{ gap: 4 }}>
							<div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
								<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
								<span style={{ color: it.error ? "var(--danger)" : it.done ? "var(--accent)" : undefined }}>
									{it.error ?? (it.done ? "enviado ✓" : `${it.pct}%`)}
								</span>
							</div>
							<div style={{ height: 4, background: "var(--line)", borderRadius: 2 }}>
								<div style={{ width: `${it.pct}%`, height: "100%", borderRadius: 2, background: it.error ? "var(--danger)" : "var(--accent)" }} />
							</div>
						</div>
					))}

					{info.takes.length ? (
						<div className="muted" style={{ fontSize: 12 }}>{info.takes.length} vídeo(s) já recebido(s) nesta postagem.</div>
					) : null}
				</>
			) : null}
		</main>
	);
}
