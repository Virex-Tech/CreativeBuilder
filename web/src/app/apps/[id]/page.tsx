"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

import { api, getToken } from "@/lib/api";
import type { AppRow, CreativeRow, ReferenceRow } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:11200";

const statusLabel: Record<ReferenceRow["status"], string> = {
	QUEUED: "na fila",
	RUNNING: "processando",
	DONE: "pronta",
	FAILED: "falhou",
};

export default function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const router = useRouter();

	const [app, setApp] = useState<AppRow | null>(null);
	const [refs, setRefs] = useState<ReferenceRow[]>([]);
	const [creatives, setCreatives] = useState<CreativeRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);

	// Gerar com IA
	const [genName, setGenName] = useState("");
	const [genBrief, setGenBrief] = useState("");
	const [genRef, setGenRef] = useState("");
	const [genBusy, setGenBusy] = useState(false);

	// Performance (CSV da Meta)
	interface MetricRow {
		creativeId: string;
		name?: string;
		metrics: {
			impressions?: number | null;
			spend?: number | null;
			hookRate?: number | null;
			holdRate?: number | null;
			ctr?: number | null;
		};
	}
	const [metrics, setMetrics] = useState<MetricRow[]>([]);
	const [metricsBusy, setMetricsBusy] = useState(false);
	const [diagBusy, setDiagBusy] = useState(false);
	const [diagnosis, setDiagnosis] = useState<string | null>(null);
	const csvInput = useRef<HTMLInputElement>(null);

	async function loadRefs(): Promise<void> {
		setRefs(await api<ReferenceRow[]>(`/apps/${id}/references`));
	}

	async function loadAll(): Promise<void> {
		const [apps, cr] = await Promise.all([
			api<AppRow[]>("/apps"),
			api<CreativeRow[]>(`/creatives?appId=${id}`),
		]);
		setApp(apps.find((a) => a.id === id) ?? null);
		setCreatives(cr);
		await loadRefs();
		setMetrics(await api<MetricRow[]>(`/apps/${id}/metrics`));
	}

	async function uploadCsv(): Promise<void> {
		const file = csvInput.current?.files?.[0];
		if (!file) return;
		setMetricsBusy(true);
		setError(null);
		try {
			const form = new FormData();
			form.append("file", file);
			const res = await fetch(`${BASE}/apps/${id}/metrics`, {
				method: "POST",
				headers: { Authorization: `Bearer ${getToken() ?? ""}` },
				body: form,
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? `HTTP ${res.status}`);
			}
			if (csvInput.current) csvInput.current.value = "";
			setMetrics(await api<MetricRow[]>(`/apps/${id}/metrics`));
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha no CSV");
		} finally {
			setMetricsBusy(false);
		}
	}

	async function diagnose(): Promise<void> {
		setDiagBusy(true);
		setError(null);
		try {
			const res = await api<{ analysis: string }>(`/apps/${id}/metrics/diagnose`, { method: "POST", body: JSON.stringify({}) });
			setDiagnosis(res.analysis);
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao diagnosticar");
		} finally {
			setDiagBusy(false);
		}
	}

	const pct = (n?: number | null): string => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);

	useEffect(() => {
		void (async () => {
			try {
				await loadAll();
			} catch (err) {
				setError(err instanceof Error ? err.message : "falha ao carregar");
			}
		})();
	}, [id]);

	// Poll while anything is still being ingested, so status flips to "pronta" on its own.
	useEffect(() => {
		if (!refs.some((r) => r.status === "QUEUED" || r.status === "RUNNING")) return;
		const t = setInterval(() => void loadRefs().catch(() => undefined), 4000);

		return () => clearInterval(t);
	}, [refs, id]);

	async function submitLink(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await api<ReferenceRow>(`/apps/${id}/references`, {
				method: "POST",
				body: JSON.stringify({ sourceUrl: url }),
			});
			setUrl("");
			await loadRefs();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao enviar link");
		} finally {
			setBusy(false);
		}
	}

	async function submitFile(): Promise<void> {
		const file = fileInput.current?.files?.[0];
		if (!file) return;
		setBusy(true);
		setError(null);
		try {
			// Multipart: the shared api() helper forces JSON, so post the file directly with
			// the auth token and let the browser set the multipart boundary.
			const form = new FormData();
			form.append("file", file);
			const res = await fetch(`${BASE}/apps/${id}/references`, {
				method: "POST",
				headers: { Authorization: `Bearer ${getToken() ?? ""}` },
				body: form,
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? `HTTP ${res.status}`);
			}
			if (fileInput.current) fileInput.current.value = "";
			await loadRefs();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha no upload");
		} finally {
			setBusy(false);
		}
	}

	async function generate(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setGenBusy(true);
		setError(null);
		try {
			const res = await api<{ creative: { id: string } }>("/creatives/generate", {
				method: "POST",
				body: JSON.stringify({
					appId: id,
					name: genName,
					brief: genBrief || undefined,
					referenceId: genRef || undefined,
				}),
			});
			router.push(`/creatives/${res.creative.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao gerar com IA");
			setGenBusy(false);
		}
	}

	const readyRefs = refs.filter((r) => r.status === "DONE");

	return (
		<main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
			<Link href="/apps" className="muted" style={{ fontSize: 13, textDecoration: "none" }}>
				← apps
			</Link>
			<h1 style={{ fontSize: 22, margin: "8px 0 0" }}>{app?.name ?? "App"}</h1>
			{app ? <div className="muted" style={{ fontSize: 12 }}>{app.slug}{app.niche ? ` · ${app.niche}` : ""}</div> : null}
			{error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

			<h2 style={{ fontSize: 18, marginTop: 28 }}>Referências</h2>
			<p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
				Mande um vídeo ou um link (Instagram, TikTok, YouTube ou URL direta). Extraímos os
				cortes, os frames e o áudio — a estrutura e o ritmo, nunca a marca da referência.
			</p>

			<div className="row" style={{ gap: 20, marginTop: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
				<div className="panel stack" style={{ padding: 16, width: 340 }}>
					<label className="muted" style={{ fontSize: 12 }}>arquivo de vídeo</label>
					<input ref={fileInput} type="file" accept="video/*" />
					<button className="primary" onClick={() => void submitFile()} disabled={busy}>
						{busy ? "enviando..." : "enviar vídeo"}
					</button>
				</div>
				<form onSubmit={submitLink} className="panel stack" style={{ padding: 16, width: 340 }}>
					<label className="muted" style={{ fontSize: 12 }}>link do vídeo</label>
					<input
						type="url"
						placeholder="https://..."
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						required
					/>
					<button className="primary" disabled={busy || !url}>
						{busy ? "enviando..." : "ingerir link"}
					</button>
				</form>
			</div>

			<div className="stack" style={{ marginTop: 16 }}>
				{refs.map((r) => (
					<div key={r.id} className="panel" style={{ padding: 14 }}>
						<div className="row" style={{ justifyContent: "space-between" }}>
							<div style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 620, whiteSpace: "nowrap" }}>
								{r.sourceUrl ? (
									<a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{r.sourceUrl}</a>
								) : (
									<span>vídeo enviado</span>
								)}
							</div>
							<span className={`badge${r.status === "DONE" ? " accent" : ""}`}>{statusLabel[r.status]}</span>
						</div>
						{r.status === "DONE" ? (
							<div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
								{r.manifest.durationSec ? `${r.manifest.durationSec.toFixed(1)}s` : "?"} ·{" "}
								{r.manifest.cutCount ?? 0} cortes ·{" "}
								ritmo {r.manifest.avgShotSec ? `${r.manifest.avgShotSec}s/cena` : "?"} ·{" "}
								{r.manifest.frames?.length ?? 0} frames ·{" "}
								{r.manifest.hasAudio ? "com áudio" : "sem áudio"}
							</div>
						) : null}
						{r.status === "FAILED" && r.error ? (
							<div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{r.error}</div>
						) : null}
					</div>
				))}
				{refs.length === 0 && !error ? <p className="muted">Nenhuma referência ainda.</p> : null}
			</div>

			<h2 style={{ fontSize: 18, marginTop: 32 }}>Gerar criativo com IA</h2>
			<p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
				A IA escreve o CreativeSpec a partir de um brief e/ou de uma referência pronta.
				Precisa da chave da Anthropic no servidor — sem ela, retorna aviso.
			</p>
			<form onSubmit={generate} className="panel stack" style={{ padding: 16, marginTop: 12, maxWidth: 560 }}>
				<input placeholder="nome do criativo" value={genName} onChange={(e) => setGenName(e.target.value)} required />
				<textarea
					placeholder="brief (ex: app de treino, oferta 50% off, hook agressivo, 20s, pt-BR)"
					value={genBrief}
					onChange={(e) => setGenBrief(e.target.value)}
					rows={3}
				/>
				<label className="muted" style={{ fontSize: 12 }}>referência (opcional)</label>
				<select value={genRef} onChange={(e) => setGenRef(e.target.value)}>
					<option value="">— sem referência —</option>
					{readyRefs.map((r) => (
						<option key={r.id} value={r.id}>{r.sourceUrl ?? "vídeo enviado"} · {r.manifest.cutCount ?? 0} cortes</option>
					))}
				</select>
				<button className="primary" disabled={genBusy || !genName}>
					{genBusy ? "gerando..." : "gerar com IA"}
				</button>
			</form>

			<h2 style={{ fontSize: 18, marginTop: 32 }}>Performance</h2>
			<p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
				Suba o CSV exportado do Gerenciador de Anúncios da Meta. As linhas casam com os
				criativos pelo <strong>nome do anúncio</strong> (ou id). Calculamos hook rate (2s
				iniciais), hold rate (p75) e CTR por posição.
			</p>
			<div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
				<input ref={csvInput} type="file" accept=".csv,text/csv" />
				<button className="primary" onClick={() => void uploadCsv()} disabled={metricsBusy}>
					{metricsBusy ? "processando..." : "subir CSV"}
				</button>
				<button onClick={() => void diagnose()} disabled={diagBusy || metrics.length === 0} title={metrics.length === 0 ? "suba um CSV primeiro" : undefined}>
					{diagBusy ? "analisando..." : "diagnosticar com IA"}
				</button>
			</div>

			{metrics.length > 0 ? (
				<div className="panel" style={{ padding: 0, marginTop: 12, overflowX: "auto" }}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ textAlign: "left" }}>
								<th style={{ padding: 10 }}>criativo</th>
								<th style={{ padding: 10 }}>impr.</th>
								<th style={{ padding: 10 }}>hook</th>
								<th style={{ padding: 10 }}>hold</th>
								<th style={{ padding: 10 }}>CTR</th>
								<th style={{ padding: 10 }}>gasto</th>
							</tr>
						</thead>
						<tbody>
							{metrics.map((m) => (
								<tr key={m.creativeId} style={{ borderTop: "1px solid var(--line)" }}>
									<td style={{ padding: 10 }}>
										<Link href={`/creatives/${m.creativeId}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{m.name ?? m.creativeId.slice(0, 8)}</Link>
									</td>
									<td style={{ padding: 10 }}>{m.metrics.impressions ?? "—"}</td>
									<td style={{ padding: 10 }}>{pct(m.metrics.hookRate)}</td>
									<td style={{ padding: 10 }}>{pct(m.metrics.holdRate)}</td>
									<td style={{ padding: 10 }}>{pct(m.metrics.ctr)}</td>
									<td style={{ padding: 10 }}>{m.metrics.spend ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{diagnosis ? (
				<div className="panel" style={{ padding: 16, marginTop: 12, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>
					{diagnosis}
				</div>
			) : null}

			<h2 style={{ fontSize: 18, marginTop: 32 }}>Criativos deste app</h2>
			<div className="stack" style={{ marginTop: 12 }}>
				{creatives.map((c) => (
					<Link key={c.id} href={`/creatives/${c.id}`} className="panel row" style={{ padding: 14, textDecoration: "none", justifyContent: "space-between" }}>
						<div style={{ fontWeight: 600 }}>{c.name}</div>
						<span className={`badge${c.renders?.[0]?.status === "DONE" ? " accent" : ""}`}>
							{c.renders?.[0]?.status ?? "sem render"}
						</span>
					</Link>
				))}
				{creatives.length === 0 ? <p className="muted">Nenhum criativo ainda.</p> : null}
			</div>
		</main>
	);
}
