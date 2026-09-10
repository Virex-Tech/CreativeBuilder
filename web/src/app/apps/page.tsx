"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { AppRow, CreativeRow } from "@/lib/types";

export default function AppsPage() {
	const [apps, setApps] = useState<AppRow[]>([]);
	const [creatives, setCreatives] = useState<CreativeRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			try {
				setApps(await api<AppRow[]>("/apps"));
				setCreatives(await api<CreativeRow[]>("/creatives"));
			} catch (err) {
				setError(err instanceof Error ? err.message : "falha ao carregar");
			}
		})();
	}, []);

	return (
		<main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
			<div className="row" style={{ justifyContent: "space-between" }}>
				<h1 style={{ fontSize: 22, margin: 0 }}>Apps</h1>
			</div>
			{error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

			<div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", marginTop: 20 }}>
				{apps.map((a) => (
					<div key={a.id} className="panel" style={{ padding: 16 }}>
						<div style={{ fontWeight: 700 }}>{a.name}</div>
						<div className="muted" style={{ fontSize: 12 }}>{a.slug}{a.niche ? ` · ${a.niche}` : ""}</div>
						<div className="row" style={{ marginTop: 10, gap: 6 }}>
							<span className="badge">{a._count?.creatives ?? 0} criativos</span>
							<span className="badge">{a._count?.references ?? 0} referências</span>
						</div>
					</div>
				))}
				{apps.length === 0 && !error ? <p className="muted">Nenhum app ainda.</p> : null}
			</div>

			<h2 style={{ fontSize: 18, marginTop: 36 }}>Criativos</h2>
			<div className="stack" style={{ marginTop: 12 }}>
				{creatives.map((c) => (
					<Link key={c.id} href={`/creatives/${c.id}`} className="panel row" style={{ padding: 14, textDecoration: "none", justifyContent: "space-between" }}>
						<div>
							<div style={{ fontWeight: 600 }}>{c.name}</div>
							<div className="muted" style={{ fontSize: 12 }}>
								v{c.versions?.[0]?.version ?? 1} · {c.locale}
								{c.mutation ? ` · ${c.mutation}` : ""}
							</div>
						</div>
						<div className="row" style={{ gap: 6 }}>
							{c._count?.children ? <span className="badge">{c._count.children} variações</span> : null}
							<span className={`badge${c.renders?.[0]?.status === "DONE" ? " accent" : ""}`}>
								{c.renders?.[0]?.status ?? "sem render"}
							</span>
						</div>
					</Link>
				))}
				{creatives.length === 0 && !error ? <p className="muted">Nenhum criativo ainda.</p> : null}
			</div>
		</main>
	);
}
