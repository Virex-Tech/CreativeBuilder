"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";

import { api, fileUrl, getToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:11200";
import type {
	AppRow,
	CompetitorAdRow,
	LookupHit,
	PipelineConfig,
	PipelineStage,
	PipelineStatus,
} from "@/lib/types";

const sourceLabel: Record<CompetitorAdRow["source"], string> = {
	trendtrack: "TrendTrack",
	meta_library: "Biblioteca Meta",
	manual: "manual",
};

/**
 * Pipeline "Concorrentes": 01 acha os vencedores (TrendTrack, Biblioteca oficial da Meta ou link manual) → 02 a IA recria pro app (referência
 * → spec → b-roll → render) → 03 o MP4 sobe pra Meta como anúncio PAUSADO. O servidor avança as
 * etapas sozinho (lib/pipeline.ts); esta tela só dispara, mostra e deixa revisar.
 */

const stageLabel: Record<PipelineStage, string> = {
	SPOTTED: "vencedor",
	QUEUED: "na fila",
	INGESTING: "lendo referência",
	GENERATING: "IA escrevendo",
	BROLL: "gerando b-roll",
	RENDERING: "renderizando",
	READY: "pronto p/ revisão",
	DRAFT_QUEUED: "enviando p/ Meta",
	DRAFTED: "rascunho na Meta",
	FAILED: "falhou",
	DISMISSED: "descartado",
};

/** Quanto do caminho 02 já andou — pinta a barrinha de cada cartão. */
const stageProgress: Partial<Record<PipelineStage, number>> = {
	QUEUED: 5,
	INGESTING: 20,
	GENERATING: 40,
	BROLL: 60,
	RENDERING: 80,
	READY: 100,
	DRAFT_QUEUED: 100,
	DRAFTED: 100,
};

const WORKING: PipelineStage[] = ["QUEUED", "INGESTING", "GENERATING", "BROLL", "RENDERING", "DRAFT_QUEUED"];

const CTAS = ["LEARN_MORE", "DOWNLOAD", "SIGN_UP", "GET_OFFER", "SHOP_NOW", "SUBSCRIBE", "INSTALL_MOBILE_APP"];

const compact = (n: number | null): string =>
	n === null ? "—" : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: 0.5 };

function Thumb({ src, size = 64 }: { src: string | null; size?: number }) {
	return src ? (
		// eslint-disable-next-line @next/next/no-img-element
		<img src={src} alt="" width={size} height={size} style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--panel-2)" }} />
	) : (
		<div style={{ width: size, height: size, borderRadius: 8, background: "var(--panel-2)", flexShrink: 0 }} />
	);
}

function Bar({ pct, color = "var(--accent)" }: { pct: number; color?: string }) {
	return (
		<div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
			<div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, transition: "width .4s" }} />
		</div>
	);
}

function ServiceCard(props: { name: string; sub: string; on: boolean; tag: string; detail?: string | null }) {
	return (
		<div className="panel row" style={{ padding: "14px 16px", justifyContent: "space-between", borderColor: props.on ? "var(--accent)" : "var(--line)" }}>
			<div style={{ minWidth: 0 }}>
				<div style={{ fontSize: 20, fontWeight: 700 }}>{props.name}</div>
				<div className="muted" style={{ ...mono, fontSize: 11, textTransform: "uppercase" }}>{props.sub}</div>
				{props.detail ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{props.detail}</div> : null}
			</div>
			<span className={`badge${props.on ? " accent" : ""}`} style={mono}>{props.on ? props.tag : "OFF"}</span>
		</div>
	);
}

function Counter({ n, label, sub, pct }: { n: number; label: string; sub: string; pct: number }) {
	return (
		<div className="stack" style={{ gap: 6 }}>
			<div className="row" style={{ alignItems: "baseline", gap: 16 }}>
				<span style={{ fontSize: 48, fontWeight: 300, lineHeight: 1 }}>{String(n).padStart(2, "0")}</span>
				<span className="muted" style={{ fontSize: 18 }}>{label}</span>
			</div>
			<div className="muted" style={{ fontSize: 12 }}>{sub}</div>
			<Bar pct={pct} />
		</div>
	);
}

export default function CompetitorPipelinePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);

	const [app, setApp] = useState<AppRow | null>(null);
	const [status, setStatus] = useState<PipelineStatus | null>(null);
	const [cfg, setCfg] = useState<PipelineConfig | null>(null);
	const [rows, setRows] = useState<CompetitorAdRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const [showConfig, setShowConfig] = useState(false);
	const [saving, setSaving] = useState(false);
	const [q, setQ] = useState("");
	const [hits, setHits] = useState<LookupHit[]>([]);
	const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
	const [manualUrl, setManualUrl] = useState("");
	const [manualName, setManualName] = useState("");
	const [manualBusy, setManualBusy] = useState(false);
	const manualFile = useRef<HTMLInputElement>(null);
	const [pageName, setPageName] = useState("");
	const [pageIdInput, setPageIdInput] = useState("");

	async function loadRows(): Promise<void> {
		setRows(await api<CompetitorAdRow[]>(`/apps/${id}/competitor-ads`));
	}

	useEffect(() => {
		void (async () => {
			try {
				const [apps, st, c] = await Promise.all([
					api<AppRow[]>("/apps"),
					api<PipelineStatus>("/pipeline/status"),
					api<PipelineConfig>(`/apps/${id}/pipeline`),
				]);
				setApp(apps.find((a) => a.id === id) ?? null);
				setStatus(st);
				setCfg(c);
				if (c.competitors.length === 0 && c.keywords.length === 0) setShowConfig(true);
				await loadRows();
			} catch (err) {
				setError(err instanceof Error ? err.message : "falha ao carregar");
			}
		})();
	}, [id]);

	// O servidor anda sozinho; a tela só acompanha enquanto houver algo em andamento.
	const working = rows.some((r) => WORKING.includes(r.stage));
	useEffect(() => {
		if (!working) return;
		const t = setInterval(() => void loadRows().catch(() => undefined), 5000);

		return () => clearInterval(t);
	}, [working, id]);

	async function act(path: string, okMsg?: string): Promise<void> {
		setError(null);
		try {
			await api(path, { method: "POST", body: JSON.stringify({}) });
			if (okMsg) setNotice(okMsg);
			await loadRows();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falhou");
		}
	}

	async function scan(): Promise<void> {
		setScanning(true);
		setError(null);
		setNotice(null);
		try {
			const res = await api<{ found: number; created: number; creditsRemaining: number | null; errors: string[] }>(
				`/apps/${id}/competitors/scan`,
				{ method: "POST", body: JSON.stringify({}) },
			);
			setNotice(
				`${res.found} vencedores encontrados, ${res.created} novos` +
					(res.creditsRemaining !== null ? ` · ${res.creditsRemaining} créditos TrendTrack restantes` : "") +
					(res.errors.length ? ` · erros: ${res.errors.join(" | ")}` : ""),
			);
			await loadRows();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha na varredura");
		} finally {
			setScanning(false);
		}
	}

	async function saveConfig(next: PipelineConfig): Promise<void> {
		setSaving(true);
		setError(null);
		try {
			// Campos vazios do formulário viram "não setado" (o schema do servidor rejeita "" em url).
			const meta = Object.fromEntries(Object.entries(next.meta).filter(([, v]) => v !== "" && v !== undefined));
			setCfg(await api<PipelineConfig>(`/apps/${id}/pipeline`, { method: "PUT", body: JSON.stringify({ ...next, meta }) }));
			setNotice("configuração salva");
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao salvar");
		} finally {
			setSaving(false);
		}
	}

	async function search(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setError(null);
		try {
			setHits(await api<LookupHit[]>(`/trendtrack/lookup?q=${encodeURIComponent(q)}`));
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha na busca");
		}
	}

	function addCompetitor(h: LookupHit): void {
		const who = h.advertiser ?? h.brandtracker;
		const pageId = who?.facebookPageId ?? h.advertiser?.id;
		if (!cfg || !who || !pageId) return;
		if (cfg.competitors.some((c) => c.pageId === pageId)) return;
		// Salva na hora: a varredura lê a config do servidor, não a da tela.
		void saveConfig({ ...cfg, competitors: [...cfg.competitors, { name: who.name, pageId }] });
		setHits([]);
		setQ("");
	}

	/** Fonte manual: link de um anúncio (ex: Biblioteca da Meta) ou o vídeo. Entra direto na etapa 02. */
	async function addManual(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setManualBusy(true);
		setError(null);
		try {
			const file = manualFile.current?.files?.[0];
			if (file) {
				const form = new FormData();
				// O campo vem antes do arquivo: o multipart do servidor só enxerga campos já lidos.
				if (manualName) form.append("advertiser", manualName);
				form.append("file", file);
				const res = await fetch(`${BASE}/apps/${id}/competitor-ads/manual`, {
					method: "POST",
					headers: { Authorization: `Bearer ${getToken() ?? ""}` },
					body: form,
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					throw new Error(body?.error ?? `HTTP ${res.status}`);
				}
				if (manualFile.current) manualFile.current.value = "";
			} else {
				await api(`/apps/${id}/competitor-ads/manual`, {
					method: "POST",
					body: JSON.stringify({ sourceUrl: manualUrl, advertiser: manualName || undefined }),
				});
			}
			setManualUrl("");
			setManualName("");
			setNotice("anúncio adicionado — já está sendo recriado");
			await loadRows();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao adicionar");
		} finally {
			setManualBusy(false);
		}
	}

	/** Concorrente pelo id da página, sem TrendTrack (serve pra Biblioteca oficial). */
	function addPageById(e: React.FormEvent): void {
		e.preventDefault();
		if (!cfg || !pageIdInput.trim() || cfg.competitors.some((c) => c.pageId === pageIdInput.trim())) return;
		void saveConfig({ ...cfg, competitors: [...cfg.competitors, { name: pageName.trim() || pageIdInput.trim(), pageId: pageIdInput.trim() }] });
		setPageName("");
		setPageIdInput("");
	}

	/** O arquivo do render exige o token no header — baixa como blob pra tocar no <video>. */
	async function watch(renderJobId: string): Promise<void> {
		if (preview?.id === renderJobId) return setPreview(null);
		try {
			const res = await fetch(fileUrl(renderJobId), { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			if (preview) URL.revokeObjectURL(preview.url);
			setPreview({ id: renderJobId, url: URL.createObjectURL(await res.blob()) });
		} catch (err) {
			setError(err instanceof Error ? `não deu pra abrir o vídeo: ${err.message}` : "falha ao abrir o vídeo");
		}
	}

	const inFlow = rows.filter((r) => r.stage !== "SPOTTED");
	const drafts = rows.filter((r) => r.stage === "DRAFTED" || r.stage === "DRAFT_QUEUED");
	const created = rows.filter((r) => r.creativeId).length;
	const ready = rows.filter((r) => r.stage === "READY" || r.stage === "DRAFT_QUEUED" || r.stage === "DRAFTED").length;
	const spotted = rows.filter((r) => r.stage === "SPOTTED").length;

	const tt = status?.trendtrack;
	const canScan = Boolean(tt?.enabled || status?.adLibrary.enabled);
	const genOn = Boolean(status?.ai.enabled && status.broll.providers.length);

	return (
		<main style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 16px" }}>
			<Link href={`/apps/${id}`} className="muted" style={{ fontSize: 13, textDecoration: "none" }}>
				← {app?.name ?? "app"}
			</Link>
			<div className="row" style={{ justifyContent: "space-between", marginTop: 8, flexWrap: "wrap" }}>
				<div className="row" style={{ gap: 14 }}>
					<h1 style={{ fontSize: 26, margin: 0 }}>Concorrentes</h1>
					<span style={{ width: 10, height: 10, borderRadius: 5, background: working ? "var(--accent)" : "var(--line)" }} />
					<span className="muted" style={{ ...mono, fontSize: 12 }}>COMPETITOR ADS AGENT</span>
				</div>
				<div className="row" style={{ gap: 8 }}>
					<button onClick={() => setShowConfig((v) => !v)}>{showConfig ? "fechar configuração" : "configurar"}</button>
					<button className="primary" onClick={() => void scan()} disabled={scanning || !canScan} title={canScan ? "" : "sem TrendTrack nem Biblioteca da Meta configurados — use o link manual"}>
						{scanning ? "varrendo..." : "varrer concorrentes"}
					</button>
				</div>
			</div>
			{error ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p> : null}
			{notice ? <p className="muted" style={{ fontSize: 13 }}>{notice}</p> : null}

			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
				<ServiceCard
					name="Descoberta"
					sub="vencedores dos concorrentes"
					on
					tag={canScan ? "LIVE" : "MANUAL"}
					detail={[
						`TrendTrack: ${tt?.error ? "erro" : tt?.enabled ? `${tt.credits ?? "?"} créditos` : "off"}`,
						`Biblioteca Meta: ${status?.adLibrary.enabled ? "on" : "off"}`,
						"link manual: on",
					].join(" · ")}
				/>
				<ServiceCard
					name="Geração"
					sub={`IA + b-roll ${status?.broll.providers.join("/") || "—"}`}
					on={genOn}
					tag="UGC"
					detail={!status ? null : !status.ai.enabled ? "IA desconectada (conecte o Codex em /apps)" : !status.broll.providers.length ? "sem provedor de b-roll" : null}
				/>
				<ServiceCard
					name="Meta Ads"
					sub="criativos em rascunho (pausados)"
					on={Boolean(status?.meta.enabled)}
					tag="DRAFT"
					detail={status?.meta.enabled ? null : "sem META_ACCESS_TOKEN / META_AD_ACCOUNT_ID"}
				/>
			</div>

			{showConfig && cfg ? (
				<div className="panel stack" style={{ padding: 16, marginTop: 16 }}>
					<div style={{ fontWeight: 600 }}>Concorrentes</div>
					<form onSubmit={search} className="row" style={{ flexWrap: "wrap" }}>
						<input placeholder="nome, domínio, @instagram ou id da página" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
						<button disabled={!q || !tt?.enabled}>buscar no TrendTrack</button>
					</form>
					{hits.length ? (
						<div className="stack" style={{ gap: 6 }}>
							{hits.filter((h) => h.advertiser ?? h.brandtracker).map((h, i) => {
								const who = h.advertiser ?? h.brandtracker;

								return (
									<div key={i} className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
										<span>{who?.name} <span className="muted">· página {who?.facebookPageId ?? h.advertiser?.id} · {h.matchType}</span></span>
										<button onClick={() => addCompetitor(h)}>adicionar</button>
									</div>
								);
							})}
						</div>
					) : null}
					<form onSubmit={addPageById} className="row" style={{ flexWrap: "wrap" }}>
						<input placeholder="nome" value={pageName} onChange={(e) => setPageName(e.target.value)} style={{ width: 160 }} />
						<input placeholder="id da página do Facebook" value={pageIdInput} onChange={(e) => setPageIdInput(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
						<button disabled={!pageIdInput.trim()}>adicionar pelo id</button>
					</form>
					<div className="muted" style={{ fontSize: 11 }}>
						O id da página aparece na Biblioteca de Anúncios (facebook.com/ads/library, filtro por anunciante → <code>view_all_page_id=</code> na URL).
					</div>
					<div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
						{cfg.competitors.map((c) => (
							<span key={c.pageId} className="badge" style={{ fontSize: 12 }}>
								{c.name}{" "}
								<button
									style={{ padding: "0 4px", marginLeft: 4, fontSize: 11 }}
									onClick={() => void saveConfig({ ...cfg, competitors: cfg.competitors.filter((x) => x.pageId !== c.pageId) })}
								>
									×
								</button>
							</span>
						))}
						{cfg.competitors.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>nenhum concorrente ainda</span> : null}
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">termos de busca (vírgula)</span>
							<input
								defaultValue={cfg.keywords.join(", ")}
								onBlur={(e) => setCfg({ ...cfg, keywords: e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length >= 2) })}
							/>
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">países da busca (ex: BR, US)</span>
							<input
								defaultValue={cfg.countries.join(", ")}
								onBlur={(e) => setCfg({ ...cfg, countries: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2) })}
							/>
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">países na Biblioteca Meta (vazio = UE/UK)</span>
							<input
								defaultValue={cfg.libraryCountries.join(", ")}
								onBlur={(e) => setCfg({ ...cfg, libraryCountries: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2) })}
							/>
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">vencedor = no ar há ≥ N dias</span>
							<input type="number" min={0} value={cfg.minDaysRunning} onChange={(e) => setCfg({ ...cfg, minDaysRunning: Number(e.target.value) })} />
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">máx. por concorrente/termo (crédito por linha)</span>
							<input type="number" min={1} max={20} value={cfg.perSource} onChange={(e) => setCfg({ ...cfg, perSource: Number(e.target.value) })} />
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">idioma do criativo</span>
							<input value={cfg.locale} onChange={(e) => setCfg({ ...cfg, locale: e.target.value })} />
						</label>
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">provedor de b-roll</span>
							<select
								value={cfg.brollProvider ?? ""}
								onChange={(e) => setCfg({ ...cfg, brollProvider: (e.target.value || undefined) as PipelineConfig["brollProvider"] })}
							>
								<option value="">padrão do servidor</option>
								{status?.broll.providers.map((p) => <option key={p} value={p}>{p}</option>)}
							</select>
						</label>
					</div>

					<div style={{ fontWeight: 600, marginTop: 8 }}>Destino na Meta (anúncio criado PAUSADO)</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
						{(
							[
								["adsetId", "id do conjunto (deixe-o pausado)"],
								["pageId", "id da página do Facebook"],
								["instagramUserId", "id da conta do Instagram (opcional)"],
								["link", "link de destino (loja / site)"],
								["message", "texto principal do anúncio"],
							] as const
						).map(([k, label]) => (
							<label key={k} className="stack" style={{ gap: 4, fontSize: 12 }}>
								<span className="muted">{label}</span>
								<input value={cfg.meta[k] ?? ""} onChange={(e) => setCfg({ ...cfg, meta: { ...cfg.meta, [k]: e.target.value } })} />
							</label>
						))}
						<label className="stack" style={{ gap: 4, fontSize: 12 }}>
							<span className="muted">botão (CTA)</span>
							<select value={cfg.meta.callToAction} onChange={(e) => setCfg({ ...cfg, meta: { ...cfg.meta, callToAction: e.target.value } })}>
								{CTAS.map((c) => <option key={c} value={c}>{c}</option>)}
							</select>
						</label>
					</div>

					<div style={{ fontWeight: 600, marginTop: 8 }}>Fontes da varredura</div>
					<label className="row" style={{ fontSize: 13, gap: 8 }}>
						<input type="checkbox" checked={cfg.sources.trendtrack} onChange={(e) => setCfg({ ...cfg, sources: { ...cfg.sources, trendtrack: e.target.checked } })} />
						TrendTrack (pago, cobre o Brasil){tt?.enabled ? "" : " — não configurado no servidor"}
					</label>
					<label className="row" style={{ fontSize: 13, gap: 8 }}>
						<input type="checkbox" checked={cfg.sources.metaLibrary} onChange={(e) => setCfg({ ...cfg, sources: { ...cfg.sources, metaLibrary: e.target.checked } })} />
						Biblioteca da Meta oficial (grátis; anúncio comercial só aparece se roda na UE/UK){status?.adLibrary.enabled ? "" : " — não configurado no servidor"}
					</label>
					<label className="row" style={{ fontSize: 13, gap: 8 }}>
						<input type="checkbox" checked={cfg.autoRecreate} onChange={(e) => setCfg({ ...cfg, autoRecreate: e.target.checked })} />
						recriar sozinho todo vencedor novo (gasta IA + b-roll sem pedir)
					</label>
					<label className="row" style={{ fontSize: 13, gap: 8 }}>
						<input type="checkbox" checked={cfg.autoDraft} onChange={(e) => setCfg({ ...cfg, autoDraft: e.target.checked })} />
						enviar sozinho pra Meta quando o render ficar pronto (sempre pausado)
					</label>
					<div>
						<button className="primary" onClick={() => void saveConfig(cfg)} disabled={saving}>{saving ? "salvando..." : "salvar configuração"}</button>
					</div>
				</div>
			) : null}

			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginTop: 24 }}>
				<Counter n={rows.length} label="vencedores" sub="anúncios achados + analisados" pct={rows.length ? 100 : 0} />
				<Counter n={created} label="criativos" sub="variações geradas pro app" pct={rows.length ? (created / rows.length) * 100 : 0} />
				<Counter n={drafts.length} label="rascunhos" sub="na Meta, esperando revisão" pct={ready ? (drafts.length / ready) * 100 : 0} />
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 24, alignItems: "start" }}>
				{/* 01 — vencedores */}
				<section className="stack" style={{ gap: 10 }}>
					<div className="row" style={{ justifyContent: "space-between" }}>
						<span className="muted" style={{ ...mono, fontSize: 11 }}>01 &nbsp; VENCEDORES DOS CONCORRENTES</span>
						{spotted ? (
							<button style={{ fontSize: 11 }} onClick={() => void act(`/apps/${id}/competitor-ads/recreate-all`, "vencedores na fila de recriação")}>
								recriar todos ({spotted})
							</button>
						) : null}
					</div>
					<form onSubmit={addManual} className="panel stack" style={{ padding: 10, gap: 6 }}>
						<input
							type="url"
							placeholder="link do anúncio (Biblioteca da Meta, Instagram, TikTok...)"
							value={manualUrl}
							onChange={(e) => setManualUrl(e.target.value)}
						/>
						<div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
							<input placeholder="concorrente (opcional)" value={manualName} onChange={(e) => setManualName(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
							<input ref={manualFile} type="file" accept="video/*" style={{ maxWidth: 190, fontSize: 11 }} />
							<button disabled={manualBusy}>{manualBusy ? "adicionando..." : "adicionar"}</button>
						</div>
					</form>
					{rows.map((r) => (
						<div key={r.id} className="panel row" style={{ padding: 10, alignItems: "flex-start", borderColor: r.stage === "SPOTTED" ? "var(--line)" : "var(--accent)" }}>
							<Thumb src={r.thumbnailUrl} />
							<div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
								<div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{r.advertiser ?? "concorrente"}
								</div>
								<div className="muted" style={{ fontSize: 12 }}>
									{r.source === "manual" ? "escolhido pelo time" : `${r.mediaType ?? "?"} · ${r.daysRunning ?? "?"}d no ar · alcance ${compact(r.reach)}`}
								</div>
								{r.content.title || r.content.body ? (
									<div className="muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
										“{r.content.title ?? r.content.body}”
									</div>
								) : null}
								<div className="row" style={{ gap: 6 }}>
									<span className="badge accent" style={mono}>{r.source === "manual" ? "PICK" : "WINNER"}</span>
									{r.content.libraryUrl ? (
										<a href={r.content.libraryUrl} target="_blank" rel="noreferrer" className="badge" style={{ textDecoration: "none" }}>
											{sourceLabel[r.source]} ↗
										</a>
									) : (
										<span className="badge">{sourceLabel[r.source]}</span>
									)}
									{r.stage === "SPOTTED" ? (
										<>
											<button style={{ fontSize: 11 }} onClick={() => void act(`/competitor-ads/${r.id}/recreate`)}>recriar</button>
											<button style={{ fontSize: 11 }} onClick={() => void act(`/competitor-ads/${r.id}/dismiss`)}>descartar</button>
										</>
									) : null}
								</div>
							</div>
						</div>
					))}
					{rows.length === 0 ? (
						<p className="muted" style={{ fontSize: 13 }}>
							Nenhum vencedor ainda. Cole o link de um anúncio acima, ou configure os concorrentes e clique em “varrer concorrentes”.
						</p>
					) : null}
				</section>

				{/* 02 — geração */}
				<section className="stack" style={{ gap: 10 }}>
					<span className="muted" style={{ ...mono, fontSize: 11 }}>02 &nbsp; GERAR NOVOS CRIATIVOS</span>
					{inFlow.map((r) => (
						<div key={r.id} className="panel stack" style={{ padding: 10, gap: 8 }}>
							<div className="row" style={{ gap: 8 }}>
								<Thumb src={r.thumbnailUrl} size={52} />
								<span className="muted">→</span>
								<div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
										{r.creative ? (
											<Link href={`/creatives/${r.creative.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{r.creative.name}</Link>
										) : (
											<span className="muted">{r.advertiser ?? "concorrente"}</span>
										)}
									</div>
									<span className={`badge${r.stage === "FAILED" ? "" : " accent"}`} style={{ ...mono, alignSelf: "flex-start", color: r.stage === "FAILED" ? "var(--danger)" : undefined }}>
										{stageLabel[r.stage]}
									</span>
								</div>
							</div>
							{r.stage !== "FAILED" ? <Bar pct={stageProgress[r.stage] ?? 0} /> : null}
							{r.error ? <div style={{ color: "var(--danger)", fontSize: 12 }}>{r.error}</div> : null}
							<div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
								{r.renderJobId && (r.stage === "READY" || r.stage === "DRAFT_QUEUED" || r.stage === "DRAFTED") ? (
									<button style={{ fontSize: 11 }} onClick={() => void watch(r.renderJobId as string)}>
										{preview?.id === r.renderJobId ? "fechar vídeo" : "assistir"}
									</button>
								) : null}
								{r.stage === "READY" ? (
									<button className="primary" style={{ fontSize: 11 }} disabled={!status?.meta.enabled} onClick={() => void act(`/competitor-ads/${r.id}/meta-draft`, "enviando pra Meta (pausado)")}>
										enviar pra Meta
									</button>
								) : null}
								{r.stage === "FAILED" ? (
									<>
										<button style={{ fontSize: 11 }} onClick={() => void act(`/competitor-ads/${r.id}/retry`)}>tentar de novo</button>
										<button style={{ fontSize: 11 }} onClick={() => void act(`/competitor-ads/${r.id}/dismiss`)}>descartar</button>
									</>
								) : null}
							</div>
							{preview && preview.id === r.renderJobId ? (
								<video src={preview.url} controls autoPlay style={{ width: "100%", maxHeight: 480, borderRadius: 8, background: "#000" }} />
							) : null}
						</div>
					))}
					{inFlow.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Clique em “recriar” num vencedor pra começar.</p> : null}
				</section>

				{/* 03 — Meta */}
				<section className="stack" style={{ gap: 10 }}>
					<span className="muted" style={{ ...mono, fontSize: 11 }}>03 &nbsp; SALVAR NA META ADS</span>
					<div className="panel" style={{ padding: 0 }}>
						{drafts.map((r, i) => (
							<div key={r.id} className="row" style={{ padding: 10, gap: 10, borderTop: i ? "1px solid var(--line)" : undefined }}>
								<Thumb src={r.thumbnailUrl} size={40} />
								<div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.creative?.name ?? r.externalId}</div>
									<div className="muted" style={{ fontSize: 11 }}>{r.stage === "DRAFTED" ? "pausado · em rascunho" : "enviando..."}</div>
								</div>
								{r.meta?.managerUrl ? (
									<a href={r.meta.managerUrl} target="_blank" rel="noreferrer" className="badge accent" style={{ textDecoration: "none" }}>
										abrir ↗
									</a>
								) : (
									<span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--muted)" }} />
								)}
							</div>
						))}
						{drafts.length === 0 ? (
							<p className="muted" style={{ fontSize: 13, padding: 12, margin: 0 }}>
								Nada na Meta ainda. Criativo pronto → “enviar pra Meta” cria o anúncio PAUSADO no conjunto configurado; publicar é sempre manual, no Gerenciador.
							</p>
						) : null}
					</div>
				</section>
			</div>

			<div className="row muted" style={{ ...mono, fontSize: 11, marginTop: 32, gap: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
				<span style={{ color: "var(--accent)" }}>SCAN</span> → <span>GENERATE</span> → <span>SAVE AS DRAFT</span>
			</div>
		</main>
	);
}
