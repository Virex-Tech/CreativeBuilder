"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CodexConnect } from "@/components/CodexConnect";
import { api } from "@/lib/api";
import { starterSpec } from "@/lib/starterSpec";
import type { AppRow, CreativeRow } from "@/lib/types";

/** Derives a URL-safe slug from a free-text name, matching the API's ^[a-z0-9-]+$ rule. */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export default function AppsPage() {
	const router = useRouter();
	const [apps, setApps] = useState<AppRow[]>([]);
	const [creatives, setCreatives] = useState<CreativeRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	// New-app form
	const [showApp, setShowApp] = useState(false);
	const [appName, setAppName] = useState("");
	const [appSlug, setAppSlug] = useState("");
	const [appNiche, setAppNiche] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);

	// New-creative form
	const [showCreative, setShowCreative] = useState(false);
	const [crAppId, setCrAppId] = useState("");
	const [crName, setCrName] = useState("");
	const [crLocale, setCrLocale] = useState("pt-BR");

	const [busy, setBusy] = useState(false);

	async function load(): Promise<void> {
		setApps(await api<AppRow[]>("/apps"));
		setCreatives(await api<CreativeRow[]>("/creatives"));
	}

	useEffect(() => {
		void (async () => {
			try {
				await load();
			} catch (err) {
				setError(err instanceof Error ? err.message : "falha ao carregar");
			}
		})();
	}, []);

	async function createApp(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await api<AppRow>("/apps", {
				method: "POST",
				body: JSON.stringify({
					name: appName,
					slug: appSlug || slugify(appName),
					niche: appNiche || undefined,
				}),
			});
			setAppName("");
			setAppSlug("");
			setAppNiche("");
			setSlugTouched(false);
			setShowApp(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao criar app");
		} finally {
			setBusy(false);
		}
	}

	async function createCreative(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const res = await api<{ creative: { id: string } }>("/creatives", {
				method: "POST",
				body: JSON.stringify({
					appId: crAppId,
					name: crName,
					locale: crLocale,
					spec: starterSpec(crAppId, crLocale),
				}),
			});
			// Straight into the editor — that is where the spec is actually shaped.
			router.push(`/creatives/${res.creative.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao criar criativo");
			setBusy(false);
		}
	}

	return (
		<main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
			<div className="row" style={{ justifyContent: "space-between" }}>
				<h1 style={{ fontSize: 22, margin: 0 }}>Apps</h1>
				<button
					className="primary"
					onClick={() => {
						setShowApp((v) => !v);
						setShowCreative(false);
					}}
				>
					{showApp ? "cancelar" : "novo app"}
				</button>
			</div>
			{error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

			<CodexConnect />

			{showApp ? (
				<form onSubmit={createApp} className="panel stack" style={{ padding: 16, marginTop: 16, maxWidth: 460 }}>
					<input
						placeholder="nome (ex: TapFit)"
						value={appName}
						onChange={(e) => {
							setAppName(e.target.value);
							if (!slugTouched) setAppSlug(slugify(e.target.value));
						}}
						required
					/>
					<input
						placeholder="slug (minúsculas, números, hífen)"
						value={appSlug}
						onChange={(e) => {
							setSlugTouched(true);
							setAppSlug(e.target.value);
						}}
						pattern="[a-z0-9-]+"
						required
					/>
					<input placeholder="nicho (opcional, ex: fitness)" value={appNiche} onChange={(e) => setAppNiche(e.target.value)} />
					<button className="primary" disabled={busy}>
						{busy ? "criando..." : "criar app"}
					</button>
				</form>
			) : null}

			<div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", marginTop: 20 }}>
				{apps.map((a) => (
					<Link key={a.id} href={`/apps/${a.id}`} className="panel" style={{ padding: 16, textDecoration: "none", display: "block" }}>
						<div style={{ fontWeight: 700 }}>{a.name}</div>
						<div className="muted" style={{ fontSize: 12 }}>{a.slug}{a.niche ? ` · ${a.niche}` : ""}</div>
						<div className="row" style={{ marginTop: 10, gap: 6 }}>
							<span className="badge">{a._count?.creatives ?? 0} criativos</span>
							<span className="badge">{a._count?.references ?? 0} referências</span>
						</div>
					</Link>
				))}
				{apps.length === 0 && !error ? <p className="muted">Nenhum app ainda.</p> : null}
			</div>

			<div className="row" style={{ justifyContent: "space-between", marginTop: 36 }}>
				<h2 style={{ fontSize: 18, margin: 0 }}>Criativos</h2>
				<button
					className="primary"
					disabled={apps.length === 0}
					title={apps.length === 0 ? "crie um app primeiro" : undefined}
					onClick={() => {
						setShowCreative((v) => !v);
						setShowApp(false);
						if (!crAppId && apps[0]) setCrAppId(apps[0].id);
					}}
				>
					{showCreative ? "cancelar" : "novo criativo"}
				</button>
			</div>

			{showCreative ? (
				<form onSubmit={createCreative} className="panel stack" style={{ padding: 16, marginTop: 16, maxWidth: 460 }}>
					<label className="muted" style={{ fontSize: 12 }}>app</label>
					<select value={crAppId} onChange={(e) => setCrAppId(e.target.value)} required>
						{apps.map((a) => (
							<option key={a.id} value={a.id}>{a.name}</option>
						))}
					</select>
					<input placeholder="nome do criativo (ex: Treino Aleatório)" value={crName} onChange={(e) => setCrName(e.target.value)} required />
					<input placeholder="locale" value={crLocale} onChange={(e) => setCrLocale(e.target.value)} required />
					<button className="primary" disabled={busy || !crAppId}>
						{busy ? "criando..." : "criar e editar"}
					</button>
					<p className="muted" style={{ fontSize: 12, margin: 0 }}>
						Nasce com um esqueleto válido (hook + CTA). Você molda o spec no editor.
					</p>
				</form>
			) : null}

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
