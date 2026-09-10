"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SpecPreview } from "@/components/SpecPreview";
import { Timeline } from "@/components/Timeline";
import { api, fileUrl } from "@/lib/api";
import type { CreativeDetail, RenderJob } from "@/lib/types";
import type { CreativeSpec } from "@render/spec";

interface PatchResult {
	unchanged?: boolean;
	changes: { path: string; from: unknown; to: unknown }[];
	issues?: { errors: string[]; warnings: string[]; durationMs: number };
}

export default function CreativePage() {
	const params = useParams<{ id: string }>();
	const [creative, setCreative] = useState<CreativeDetail | null>(null);
	const [draft, setDraft] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<PatchResult | null>(null);
	const [job, setJob] = useState<RenderJob | null>(null);
	const [busy, setBusy] = useState(false);
	const [instruction, setInstruction] = useState("");
	const [aiBusy, setAiBusy] = useState(false);
	const [brollBusy, setBrollBusy] = useState(false);

	const load = useCallback(async () => {
		const data = await api<CreativeDetail>(`/creatives/${params.id}`);
		setCreative(data);
		setDraft(JSON.stringify(data.versions[0]?.spec ?? {}, null, 2));
	}, [params.id]);

	useEffect(() => {
		void load().catch((err: unknown) => {
			setError(err instanceof Error ? err.message : "falha ao carregar");
		});
	}, [load]);

	/**
	 * The preview follows the DRAFT, not the saved version — so a typo shows up as a broken
	 * preview instead of being saved first and discovered later. Invalid JSON falls back to
	 * the last good spec rather than blanking the player.
	 */
	const lastGood = useRef<CreativeSpec | null>(null);
	const previewSpec = useMemo(() => {
		try {
			const parsed = JSON.parse(draft) as CreativeSpec;
			if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
				lastGood.current = parsed;

				return parsed;
			}
		} catch {
			// fall through
		}

		return lastGood.current;
	}, [draft]);

	const draftIsValid = useMemo(() => {
		try {
			JSON.parse(draft);

			return true;
		} catch {
			return false;
		}
	}, [draft]);

	async function save() {
		setBusy(true);
		setError(null);
		try {
			const patch = JSON.parse(draft) as Record<string, unknown>;
			const res = await api<PatchResult>(`/creatives/${params.id}/spec`, {
				method: "PATCH",
				body: JSON.stringify({ patch }),
			});
			setResult(res);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao salvar");
		} finally {
			setBusy(false);
		}
	}

	async function render(kind: "VIDEO" | "STILL") {
		setBusy(true);
		setError(null);
		try {
			const res = await api<{ job: RenderJob; reused: boolean }>(
				`/creatives/${params.id}/render`,
				{ method: "POST", body: JSON.stringify({ kind, frame: 0 }) },
			);
			setJob(res.job);
			if (res.job.status !== "DONE") poll(res.job.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao renderizar");
		} finally {
			setBusy(false);
		}
	}

	async function adjust() {
		if (!instruction.trim()) return;
		setAiBusy(true);
		setError(null);
		try {
			const res = await api<PatchResult>(`/creatives/${params.id}/adjust`, {
				method: "POST",
				body: JSON.stringify({ instruction }),
			});
			setResult(res);
			setInstruction("");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao ajustar com IA");
		} finally {
			setAiBusy(false);
		}
	}

	async function broll() {
		setBrollBusy(true);
		setError(null);
		try {
			const res = await api<{ generated?: number; unchanged?: boolean; message?: string }>(
				`/creatives/${params.id}/broll`,
				{ method: "POST", body: JSON.stringify({}) },
			);
			if (res.unchanged) setError(res.message ?? "nenhuma camada generative_video pendente");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao gerar b-roll");
		} finally {
			setBrollBusy(false);
		}
	}

	function poll(jobId: string) {
		const timer = setInterval(() => {
			void api<RenderJob>(`/render-jobs/${jobId}`)
				.then((j) => {
					setJob(j);
					if (j.status === "DONE" || j.status === "FAILED") clearInterval(timer);
				})
				.catch(() => clearInterval(timer));
		}, 2000);
	}

	if (error && !creative) return <main style={{ padding: 32, color: "var(--danger)" }}>{error}</main>;
	if (!creative) return <main style={{ padding: 32 }} className="muted">carregando…</main>;

	return (
		<main style={{ padding: 24, display: "grid", gap: 20, gridTemplateColumns: "minmax(320px,420px) 1fr" }}>
			<section className="stack">
				<div>
					<Link href="/apps" className="muted" style={{ fontSize: 12 }}>← apps</Link>
					<h1 style={{ fontSize: 20, margin: "6px 0 0" }}>{creative.name}</h1>
					<div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
						<span className="badge">{creative.locale}</span>
						<span className="badge">v{creative.versions[0]?.version ?? 1}</span>
						{creative.mutation ? <span className="badge accent">{creative.mutation}</span> : null}
						{creative.parent ? (
							<Link href={`/creatives/${creative.parent.id}`} className="badge">
								← {creative.parent.name}
							</Link>
						) : null}
					</div>
				</div>

				{previewSpec ? <SpecPreview spec={previewSpec} /> : <p className="muted">spec inválido</p>}

				<div className="row">
					<button className="primary" onClick={() => void render("VIDEO")} disabled={busy}>
						renderizar MP4
					</button>
					<button onClick={() => void render("STILL")} disabled={busy}>
						still
					</button>
					<button onClick={() => void broll()} disabled={brollBusy}>
						{brollBusy ? "gerando b-roll..." : "gerar b-roll"}
					</button>
				</div>

				<div className="panel stack" style={{ padding: 12 }}>
					<div className="muted" style={{ fontSize: 12 }}>ajustar com IA</div>
					<input
						placeholder="ex: encurta o hook pra 1.8s / versão em espanhol / troca a cena 2"
						value={instruction}
						onChange={(e) => setInstruction(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void adjust();
						}}
					/>
					<button onClick={() => void adjust()} disabled={aiBusy || !instruction.trim()}>
						{aiBusy ? "ajustando..." : "aplicar ajuste"}
					</button>
				</div>

				{job ? (
					<div className="panel" style={{ padding: 12 }}>
						<div className="row" style={{ justifyContent: "space-between" }}>
							<span>{job.kind} · {job.status}</span>
							<span className="muted">{job.progress}%</span>
						</div>
						{job.error ? <div style={{ color: "var(--danger)", fontSize: 12 }}>{job.error}</div> : null}
						{job.status === "DONE" ? (
							<a href={fileUrl(job.id)} target="_blank" rel="noreferrer" className="badge accent" style={{ marginTop: 8, display: "inline-block" }}>
								abrir arquivo
							</a>
						) : null}
					</div>
				) : null}

				{creative.children.length > 0 ? (
					<div className="panel" style={{ padding: 12 }}>
						<div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>variações</div>
						<div className="stack" style={{ gap: 6 }}>
							{creative.children.map((c) => (
								<Link key={c.id} href={`/creatives/${c.id}`} className="row" style={{ justifyContent: "space-between", textDecoration: "none" }}>
									<span>{c.name}</span>
									<span className="badge accent">{c.mutation}</span>
								</Link>
							))}
						</div>
					</div>
				) : null}
			</section>

			<section className="stack">
				{previewSpec ? <Timeline spec={previewSpec} /> : null}

				<div className="row" style={{ justifyContent: "space-between" }}>
					<strong style={{ fontSize: 13 }}>spec</strong>
					<div className="row">
						{!draftIsValid ? <span className="badge" style={{ color: "var(--danger)" }}>JSON inválido</span> : null}
						<button className="primary" onClick={() => void save()} disabled={busy || !draftIsValid}>
							salvar nova versão
						</button>
					</div>
				</div>

				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					spellCheck={false}
					style={{ minHeight: 460, resize: "vertical" }}
				/>

				{error ? <div style={{ color: "var(--danger)" }}>{error}</div> : null}

				{result ? (
					<div className="panel" style={{ padding: 12 }}>
						{result.unchanged ? (
							<span className="muted">nada mudou — nenhuma versão criada</span>
						) : (
							<>
								<div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
									{result.changes.length} alterações
								</div>
								<div className="stack" style={{ gap: 4, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
									{result.changes.slice(0, 20).map((c) => (
										<div key={c.path}>
											<span className="muted">{c.path}</span>{" "}
											{JSON.stringify(c.from)} → <span style={{ color: "var(--accent)" }}>{JSON.stringify(c.to)}</span>
										</div>
									))}
								</div>
							</>
						)}
						{result.issues?.warnings.length ? (
							<div style={{ marginTop: 10, fontSize: 12, color: "#e8c76a" }}>
								{result.issues.warnings.map((w) => <div key={w}>⚠ {w}</div>)}
							</div>
						) : null}
					</div>
				) : null}
			</section>
		</main>
	);
}
