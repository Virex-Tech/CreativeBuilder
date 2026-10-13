"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudioNav } from "@/components/StudioNav";
import { api, uploadFile } from "@/lib/api";
import { atSp, band, fmtDur, spDate, spTime, statusText, WORKING } from "@/lib/studio";
import type { PostDetail, SocialAccountRow, StudioStatus, TakeRow } from "@/lib/types";

/**
 * Uma postagem: à esquerda o vídeo e a decisão (aprovar / pedir alteração), no meio a montagem
 * (referência, takes, instrução) e à direita a legenda, o horário e a publicação.
 */

const sourceLabel: Record<TakeRow["source"], string> = {
	UPLOAD: "upload",
	LINK: "link",
	DRIVE: "Drive",
	SENDER: "link de envio",
	KIE: "gerado (IA)",
};

const takeStatus: Record<TakeRow["status"], string> = {
	RECEIVING: "recebendo…",
	QUEUED: "na fila",
	GENERATING: "IA gerando (~2 min)…",
	PROCESSING: "processando e transcrevendo…",
	DONE: "pronto",
	FAILED: "falhou",
};

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
	return (
		<section className="panel stack" style={{ padding: 14, gap: 10 }}>
			<div className="row" style={{ justifyContent: "space-between" }}>
				<strong style={{ fontSize: 13, letterSpacing: 0.5 }}>{title}</strong>
				{right}
			</div>
			{children}
		</section>
	);
}

interface Upload {
	name: string;
	pct: number;
	error?: string;
}

export default function PostPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const [post, setPost] = useState<PostDetail | null>(null);
	const [status, setStatus] = useState<StudioStatus | null>(null);
	const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	// Campos editáveis (salvos no blur / no botão)
	const [title, setTitle] = useState("");
	const [instructions, setInstructions] = useState("");
	const [caption, setCaption] = useState("");
	const [date, setDate] = useState("");
	const [time, setTime] = useState("");

	const [refLink, setRefLink] = useState("");
	const [linkText, setLinkText] = useState("");
	const [driveUrl, setDriveUrl] = useState("");
	const [genPrompt, setGenPrompt] = useState("");
	const [genCost, setGenCost] = useState<{ usd: number; balanceUsd: number | null; enough: boolean | null } | null>(null);
	const [addMode, setAddMode] = useState<"upload" | "link" | "drive" | "ia" | "enviar">("upload");
	const [uploads, setUploads] = useState<Upload[]>([]);
	const [note, setNote] = useState("");
	const [refOptions, setRefOptions] = useState<{ id: string; sourceUrl: string | null; thumbUrl: string | null }[] | null>(null);
	const video = useRef<HTMLVideoElement>(null);
	const hydrated = useRef(false);

	const apply = useCallback((p: PostDetail) => {
		setPost(p);
		// Só preenche os campos na 1ª carga — depois, o que a pessoa está digitando manda.
		if (!hydrated.current) {
			hydrated.current = true;
			setTitle(p.title ?? "");
			setInstructions(p.instructions ?? "");
			setDate(spDate(new Date(p.scheduledAt)));
			setTime(spTime(p.scheduledAt));
			setDriveUrl(p.account.driveFolder ?? "");
		}
		// A legenda a IA escreve durante a edição: acompanha enquanto a pessoa não mexeu nela.
		setCaption((cur) => (cur === "" || !hydrated.current ? p.caption ?? "" : cur));
	}, []);

	const load = useCallback(async () => {
		apply(await api<PostDetail>(`/studio/posts/${id}`));
	}, [apply, id]);

	useEffect(() => {
		void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "falha ao carregar"));
		void api<StudioStatus>("/studio/status").then(setStatus).catch(() => undefined);
		void api<SocialAccountRow[]>("/studio/accounts").then(setAccounts).catch(() => undefined);
	}, [load]);

	const live = !!post && (WORKING.includes(post.status) || post.takes.some((t) => !["DONE", "FAILED"].includes(t.status)) || (post.reference && ["QUEUED", "RUNNING"].includes(post.reference.status)));
	useEffect(() => {
		if (!live) return;
		const t = setInterval(() => void load().catch(() => undefined), 3000);

		return () => clearInterval(t);
	}, [live, load]);

	async function act<T>(key: string, fn: () => Promise<T>, done?: (r: T) => void) {
		setBusy(key);
		setError(null);
		setNotice(null);
		try {
			const r = await fn();
			done?.(r);
		} catch (e) {
			setError(e instanceof Error ? e.message : "falhou");
		} finally {
			setBusy(null);
		}
	}

	const patch = (body: Record<string, unknown>) =>
		act("save", () => api<PostDetail>(`/studio/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }), apply);

	const post$ = (path: string, body?: unknown) =>
		api<PostDetail>(`/studio/posts/${id}${path}`, { method: "POST", body: JSON.stringify(body ?? {}) });

	async function uploadTakes(files: FileList | File[]) {
		const list = Array.from(files);
		setUploads(list.map((f) => ({ name: f.name, pct: 0 })));
		for (const [i, f] of list.entries()) {
			try {
				await uploadFile(`/studio/posts/${id}/takes`, f, (pct) =>
					setUploads((u) => u.map((x, j) => (j === i ? { ...x, pct } : x))),
				);
				setUploads((u) => u.map((x, j) => (j === i ? { ...x, pct: 100 } : x)));
				await load();
			} catch (e) {
				setUploads((u) => u.map((x, j) => (j === i ? { ...x, error: e instanceof Error ? e.message : "falhou" } : x)));
			}
		}
		setTimeout(() => setUploads((u) => u.filter((x) => x.error)), 1500);
	}

	async function uploadReference(file: File) {
		await act("ref", () => uploadFile<PostDetail>(`/studio/posts/${id}/reference`, file), apply);
	}

	function stampTime() {
		const t = video.current?.currentTime ?? 0;
		setNote((n) => `${n}${n && !n.endsWith(" ") ? " " : ""}[${mmss(t)}] `);
	}

	if (error && !post) return (<><StudioNav /><main style={{ padding: 32, color: "var(--danger)" }}>{error}</main></>);
	if (!post) return (<><StudioNav /><main style={{ padding: 32 }} className="muted">carregando…</main></>);

	const b = band({ ...post, hasReference: !!post.reference, takes: post.takes.length, takesPending: post.takes.filter((t) => !["DONE", "FAILED"].includes(t.status)).length });
	const canEdit = ["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "FAILED"].includes(post.status);
	const canDecide = ["REVIEW", "APPROVED", "SCHEDULED", "FAILED"].includes(post.status) && !!post.videoFile;
	const readyTakes = post.takes.filter((t) => t.status === "DONE").length;
	const working = WORKING.includes(post.status);
	const locked = post.status === "PUBLISHED" || post.status === "PUBLISHING";

	return (
		<>
			<StudioNav />
			<main style={{ padding: "16px 24px 60px", maxWidth: 1500, margin: "0 auto" }}>
				<div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
					<div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
						<Link href="/estudio" className="muted" style={{ fontSize: 13 }}>← calendário</Link>
						<strong>@{post.account.handle}</strong>
						<span className="muted">{spDate(new Date(post.scheduledAt)).split("-").reverse().join("/")} · {spTime(post.scheduledAt)}</span>
						{b ? <span className="badge" style={{ color: b.color, borderColor: b.color, textTransform: "uppercase" }}>{b.label}</span> : null}
					</div>
					<span className="muted" style={{ fontSize: 13 }}>{statusText[post.status]}</span>
				</div>

				{error ? <div style={{ color: "var(--danger)", marginBottom: 10 }}>{error}</div> : null}
				{notice ? <div className="badge accent" style={{ marginBottom: 10, padding: "6px 12px" }}>{notice}</div> : null}
				{post.status === "FAILED" && post.error ? (
					<div className="panel row" style={{ padding: 12, borderColor: "var(--danger)", marginBottom: 12, justifyContent: "space-between", gap: 12 }}>
						<span style={{ color: "#ffb4b4", fontSize: 13 }}>{post.error}</span>
						<button onClick={() => void act("retry", () => post$("/retry"), apply)} disabled={busy !== null}>tentar de novo</button>
					</div>
				) : post.error ? (
					<div className="panel" style={{ padding: 10, borderColor: "#ffb020", marginBottom: 12, fontSize: 13 }}>{post.error}</div>
				) : null}

				<div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 360px) minmax(340px, 1fr) minmax(280px, 380px)", alignItems: "start" }}>
					{/* ---------------------------------------------------------- vídeo + decisão */}
					<div className="stack" style={{ gap: 12, position: "sticky", top: 12 }}>
						<div style={{ aspectRatio: "9 / 16", borderRadius: 14, overflow: "hidden", background: "#000", border: "1px solid var(--line)", position: "relative" }}>
							{post.videoUrl ? (
								<video key={post.videoUrl} ref={video} src={post.videoUrl} poster={post.posterUrl ?? undefined} controls playsInline loop style={{ width: "100%", height: "100%", objectFit: "contain" }} />
							) : (
								<div className="stack" style={{ height: "100%", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 8 }}>
									{working ? (
										<>
											<div className="pulse" style={{ fontSize: 30 }}>✂︎</div>
											<div>{statusText[post.status]}</div>
											{post.status === "RENDERING" && post.render ? <div className="muted">{post.render.progress}%</div> : null}
											<div className="muted" style={{ fontSize: 12 }}>pode sair da tela — continua sozinho</div>
										</>
									) : (
										<>
											<div className="muted">o vídeo editado aparece aqui</div>
											<div className="muted" style={{ fontSize: 12 }}>monte a postagem ao lado e clique em &quot;editar com IA&quot;</div>
										</>
									)}
								</div>
							)}
							{working && post.videoUrl ? (
								<div className="pulse" style={{ position: "absolute", top: 8, left: 8, right: 8, background: "#a855f7", color: "#0b0b0f", fontWeight: 800, fontSize: 11, textAlign: "center", borderRadius: 8, padding: 4 }}>
									{statusText[post.status]} — este é o vídeo anterior
								</div>
							) : null}
						</div>

						{canDecide && !working ? (
							<div className="panel stack" style={{ padding: 12, gap: 8 }}>
								{post.status === "REVIEW" || post.status === "FAILED" ? (
									<div className="row" style={{ gap: 8 }}>
										<button className="primary" style={{ flex: 1 }} disabled={busy !== null} onClick={() => void act("approve", () => post$("/approve"), (p) => { apply(p); setNotice(p.status === "SCHEDULED" ? `aprovado — publica às ${spTime(p.scheduledAt)}` : "aprovado — poste à mão e marque como postado"); })}>
											aprovar
										</button>
										{post.account.connected ? (
											<button disabled={busy !== null} onClick={() => { if (confirm("Publicar agora no Instagram?")) void act("now", () => post$("/approve", { now: true }), apply); }}>
												postar agora
											</button>
										) : null}
									</div>
								) : (
									<div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
										<span style={{ fontSize: 13 }}>{post.status === "SCHEDULED" ? `publica sozinho às ${spTime(post.scheduledAt)}` : "aprovado"}</span>
										<button onClick={() => void act("unapprove", () => post$("/unapprove"), apply)} disabled={busy !== null} style={{ fontSize: 12 }}>desaprovar</button>
									</div>
								)}
								<div className="stack" style={{ gap: 6 }}>
									<textarea
										value={note}
										onChange={(e) => setNote(e.target.value)}
										rows={3}
										placeholder="pedir alteração: ex. [0:03] corta essa parte · hook mais curto · legenda menor · usa o take 2 no começo"
										style={{ fontFamily: "inherit", fontSize: 13 }}
									/>
									<div className="row" style={{ gap: 8 }}>
										<button onClick={stampTime} title="insere o tempo atual do vídeo" style={{ fontSize: 12 }}>+ tempo atual</button>
										<button style={{ flex: 1 }} disabled={busy !== null || note.trim().length < 2} onClick={() => void act("revise", () => post$("/revise", { note }), (p) => { apply(p); setNote(""); })}>
											pedir alteração
										</button>
									</div>
								</div>
							</div>
						) : null}

						{post.versions.length ? (
							<div className="panel stack" style={{ padding: 12, gap: 6 }}>
								<div className="row" style={{ justifyContent: "space-between" }}>
									<span className="muted" style={{ fontSize: 12 }}>histórico</span>
									<div className="row" style={{ gap: 8 }}>
										{post.videoUrl ? <a href={post.videoUrl} download className="muted" style={{ fontSize: 12 }}>baixar MP4</a> : null}
										{post.creativeId ? <Link href={`/creatives/${post.creativeId}`} className="muted" style={{ fontSize: 12 }}>abrir no editor</Link> : null}
									</div>
								</div>
								{post.versions.slice(0, 8).map((v) => (
									<div key={v.version} style={{ fontSize: 12 }}>
										<span className="badge">v{v.version}</span> <span className="muted">{v.note ?? v.createdBy}</span>
									</div>
								))}
							</div>
						) : null}
					</div>

					{/* ---------------------------------------------------------- montagem */}
					<div className="stack" style={{ gap: 12 }}>
						<Section
							title="Referência"
							right={post.reference ? (
								<button style={{ fontSize: 12, padding: "3px 10px" }} disabled={!canEdit} onClick={() => void act("ref", () => api<PostDetail>(`/studio/posts/${id}/reference`, { method: "DELETE" }), apply)}>trocar</button>
							) : null}
						>
							{post.reference ? (
								<div className="stack" style={{ gap: 8 }}>
									<div className="muted" style={{ fontSize: 12 }}>
										{post.reference.status === "DONE"
											? `${post.reference.durationSec?.toFixed(1) ?? "?"}s · corte médio ${post.reference.avgShotSec ?? "?"}s`
											: post.reference.status === "FAILED"
												? <span style={{ color: "var(--danger)" }}>não consegui ler: {post.reference.error}</span>
												: "lendo a referência (frames + fala)…"}
										{post.reference.sourceUrl ? <> · <a href={post.reference.sourceUrl} target="_blank" rel="noreferrer">abrir</a></> : null}
									</div>
									{post.reference.frames.length ? (
										<div className="row" style={{ gap: 4, overflowX: "auto" }}>
											{post.reference.frames.filter(Boolean).map((f) => (
												// eslint-disable-next-line @next/next/no-img-element
												<img key={f} src={f as string} alt="" style={{ height: 96, borderRadius: 6 }} />
											))}
										</div>
									) : null}
									{post.reference.transcript ? (
										<div className="muted" style={{ fontSize: 12, fontStyle: "italic" }}>&ldquo;{post.reference.transcript.slice(0, 280)}{post.reference.transcript.length > 280 ? "…" : ""}&rdquo;</div>
									) : null}
								</div>
							) : (
								<div className="stack" style={{ gap: 8 }}>
									<div className="row" style={{ gap: 8 }}>
										<input value={refLink} onChange={(e) => setRefLink(e.target.value)} placeholder="link do Reels/TikTok/YouTube da referência" disabled={!canEdit} />
										<button disabled={!canEdit || !refLink || busy !== null} onClick={() => void act("ref", () => post$("/reference", { sourceUrl: refLink }), (p) => { apply(p); setRefLink(""); })}>usar</button>
									</div>
									<div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
										<label className="badge" style={{ cursor: "pointer", padding: "5px 10px" }}>
											subir vídeo
											<input type="file" accept="video/*" hidden disabled={!canEdit} onChange={(e) => e.target.files?.[0] && void uploadReference(e.target.files[0])} />
										</label>
										<button style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => void api<typeof refOptions>(`/studio/posts/${id}/reference-options`).then(setRefOptions)}>
											escolher uma já usada
										</button>
									</div>
									{refOptions ? (
										refOptions.length ? (
											<div className="row" style={{ gap: 6, overflowX: "auto" }}>
												{refOptions.map((r) => (
													<button key={r.id} title={r.sourceUrl ?? ""} style={{ padding: 0, width: 64, aspectRatio: "9/16", background: r.thumbUrl ? `center / cover url("${r.thumbUrl}")` : "var(--panel-2)", flexShrink: 0 }} onClick={() => void act("ref", () => post$("/reference", { referenceId: r.id }), (p) => { apply(p); setRefOptions(null); })} />
												))}
											</div>
										) : (
											<span className="muted" style={{ fontSize: 12 }}>nenhuma referência lida ainda neste app</span>
										)
									) : null}
								</div>
							)}
						</Section>

						<Section title={`Takes ${post.takes.length ? `(${readyTakes}/${post.takes.length} prontos)` : ""}`}>
							{post.takes.length ? (
								<div className="stack" style={{ gap: 8 }}>
									{post.takes.map((t, i) => (
										<div key={t.id} className="row" style={{ gap: 10, alignItems: "flex-start", padding: 8, borderRadius: 10, background: "var(--panel-2)" }}>
											<div style={{ width: 54, aspectRatio: "9/16", borderRadius: 6, flexShrink: 0, background: t.thumbUrl ? `center / cover url("${t.thumbUrl}")` : "var(--line)" }} />
											<div className="stack" style={{ gap: 3, minWidth: 0, flex: 1 }}>
												<div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
													<strong style={{ fontSize: 12 }}>take {i + 1}</strong>
													<span className="muted" style={{ fontSize: 11 }}>{sourceLabel[t.source]} · {fmtDur(t.durationMs)}</span>
													<span className="badge" style={t.status === "FAILED" ? { color: "var(--danger)", borderColor: "var(--danger)" } : t.status === "DONE" ? {} : { color: "#a855f7", borderColor: "#a855f7" }}>
														{takeStatus[t.status]}
													</span>
												</div>
												{t.originalName ? <div className="muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.originalName}</div> : null}
												{t.error ? <div style={{ color: "#ffb4b4", fontSize: 11 }}>{t.error}</div> : null}
												{t.text ? <div style={{ fontSize: 12, lineHeight: 1.35 }}>&ldquo;{t.text.slice(0, 220)}{t.text.length > 220 ? "…" : ""}&rdquo;</div> : t.status === "DONE" ? <div className="muted" style={{ fontSize: 11 }}>(sem fala)</div> : null}
											</div>
											<div className="stack" style={{ gap: 4 }}>
												{t.videoUrl ? <a href={t.videoUrl} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 11 }}>ver</a> : null}
												{t.status === "FAILED" ? <button style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => void act("take", () => api(`/studio/takes/${t.id}/retry`, { method: "POST" }), () => void load())}>de novo</button> : null}
												{canEdit ? <button style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => void act("take", () => api(`/studio/takes/${t.id}`, { method: "DELETE" }), () => void load())}>tirar</button> : null}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="muted" style={{ fontSize: 12 }}>Sem takes, a IA monta só com b-roll gerado, texto e a tela do app.</div>
							)}

							{canEdit ? (
								<div className="stack" style={{ gap: 8, marginTop: 4 }}>
									<div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
										{([
											["upload", "subir arquivos"],
											["link", "links"],
											["drive", "pasta do Drive"],
											["enviar", "link p/ o criador"],
											["ia", "gerar com IA"],
										] as const).map(([k, label]) => (
											<button key={k} onClick={() => setAddMode(k)} style={{ fontSize: 12, padding: "4px 10px", ...(addMode === k ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }}>
												{label}
											</button>
										))}
									</div>

									{addMode === "upload" ? (
										<label
											onDragOver={(e) => e.preventDefault()}
											onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void uploadTakes(e.dataTransfer.files); }}
											style={{ border: "1px dashed var(--line)", borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer" }}
										>
											<span className="muted" style={{ fontSize: 13 }}>arraste os vídeos aqui ou clique pra escolher (vários de uma vez)</span>
											<input type="file" accept="video/*" multiple hidden onChange={(e) => e.target.files && void uploadTakes(e.target.files)} />
										</label>
									) : null}
									{uploads.map((u) => (
										<div key={u.name} className="stack" style={{ gap: 2 }}>
											<div className="row" style={{ justifyContent: "space-between", fontSize: 11 }}>
												<span>{u.name}</span>
												<span style={u.error ? { color: "var(--danger)" } : undefined}>{u.error ?? `${u.pct}%`}</span>
											</div>
											<div style={{ height: 3, background: "var(--line)", borderRadius: 2 }}>
												<div style={{ width: `${u.pct}%`, height: "100%", background: u.error ? "var(--danger)" : "var(--accent)", borderRadius: 2 }} />
											</div>
										</div>
									))}

									{addMode === "link" ? (
										<div className="stack" style={{ gap: 6 }}>
											<textarea value={linkText} onChange={(e) => setLinkText(e.target.value)} rows={3} placeholder={"um link por linha — arquivo do Drive, Dropbox, WeTransfer direto, Instagram, TikTok…"} style={{ fontSize: 12 }} />
											<button disabled={busy !== null || !linkText.trim()} onClick={() => void act("links", () => post$("/takes/link", { urls: linkText.split(/\s+/).filter((u) => /^https?:\/\//.test(u)) }), (p) => { apply(p); setLinkText(""); })}>
												adicionar links
											</button>
										</div>
									) : null}

									{addMode === "drive" ? (
										<div className="stack" style={{ gap: 6 }}>
											<div className="row" style={{ gap: 8 }}>
												<input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
												<button disabled={busy !== null || !driveUrl} onClick={() => void act("drive", () => api<{ imported: number; skipped: number; post: PostDetail }>(`/studio/posts/${id}/takes/drive`, { method: "POST", body: JSON.stringify({ folderUrl: driveUrl }) }), (r) => { apply(r.post); setNotice(`${r.imported} vídeo(s) importado(s)${r.skipped ? `, ${r.skipped} já estavam aqui` : ""}`); })}>
													importar
												</button>
											</div>
											<span className="muted" style={{ fontSize: 11 }}>A pasta precisa estar como &quot;qualquer pessoa com o link&quot;. Importar de novo só traz os vídeos novos.</span>
										</div>
									) : null}

									{addMode === "enviar" ? (
										post.uploadUrl ? (
											<div className="stack" style={{ gap: 6 }}>
												<div className="row" style={{ gap: 8 }}>
													<input readOnly value={post.uploadUrl} onFocus={(e) => e.target.select()} />
													<button onClick={() => void navigator.clipboard.writeText(post.uploadUrl as string).then(() => setNotice("link copiado"))}>copiar</button>
												</div>
												<span className="muted" style={{ fontSize: 11 }}>Mande pro criador (WhatsApp): ele abre no celular e sobe os takes sem login. Os vídeos caem aqui sozinhos.</span>
											</div>
										) : (
											<span className="muted" style={{ fontSize: 12 }}>PUBLIC_WEB_URL não configurado no servidor.</span>
										)
									) : null}

									{addMode === "ia" ? (
										status?.kie ? (
											<div className="stack" style={{ gap: 6 }}>
												<textarea value={genPrompt} onChange={(e) => { setGenPrompt(e.target.value); setGenCost(null); }} rows={4} style={{ fontSize: 12 }} placeholder={'Selfie vertical de uma mulher de 28 anos na academia, luz natural, falando pra câmera em português: "Eu não sabia o que treinar até achar esse app"'} />
												<div className="row" style={{ gap: 8 }}>
													{genCost === null ? (
														<button disabled={busy !== null || genPrompt.length < 10} onClick={() => void act("gen", () => api<{ cost: { usd: number; balanceUsd: number | null; enough: boolean | null } }>(`/studio/posts/${id}/takes/generate`, { method: "POST", body: JSON.stringify({ prompt: genPrompt }) }), (r) => setGenCost(r.cost))}>
															ver custo
														</button>
													) : genCost.enough === false ? (
														<span style={{ color: "#ffb020", fontSize: 12 }}>
															custa US$ {genCost.usd.toFixed(2)}, saldo na kie.ai: US$ {genCost.balanceUsd?.toFixed(2)} — recarregue em kie.ai
														</span>
													) : (
														<button className="primary" disabled={busy !== null} onClick={() => void act("gen", () => api<{ post: PostDetail }>(`/studio/posts/${id}/takes/generate`, { method: "POST", body: JSON.stringify({ prompt: genPrompt, confirm: true }) }), (r) => { apply(r.post); setGenPrompt(""); setGenCost(null); })}>
															gerar take de 8s — US$ {genCost.usd.toFixed(2)}{genCost.balanceUsd !== null ? ` (saldo US$ ${genCost.balanceUsd.toFixed(2)})` : ""}
														</button>
													)}
												</div>
												<span className="muted" style={{ fontSize: 11 }}>Veo ({status.takeModel}) na kie.ai: pessoa falando, com som. Fala entre aspas no prompt.</span>
											</div>
										) : (
											<span className="muted" style={{ fontSize: 12 }}>kie.ai não configurada no servidor (KIE_API_KEY).</span>
										)
									) : null}
								</div>
							) : null}
						</Section>

						<Section title="Instrução de edição">
							<textarea
								value={instructions}
								onChange={(e) => setInstructions(e.target.value)}
								onBlur={() => instructions !== (post.instructions ?? "") && void patch({ instructions: instructions || null })}
								rows={5}
								disabled={!canEdit}
								style={{ fontFamily: "inherit", fontSize: 13 }}
								placeholder={"o que você diria pro editor. ex: começa pela frase do \"você treina errado\", corta os silêncios, 20s no máximo, legenda amarela, termina mostrando o app"}
							/>
							{post.account.style ? <div className="muted" style={{ fontSize: 11 }}>+ estilo padrão da conta: {post.account.style.slice(0, 160)}</div> : null}
							<div className="row" style={{ gap: 8 }}>
								<button
									className="primary"
									disabled={!canEdit || busy !== null || (status ? !status.ai : false)}
									title={status && !status.ai ? "IA do servidor não conectada" : ""}
									onClick={async () => {
										if (instructions !== (post.instructions ?? "")) await api(`/studio/posts/${id}`, { method: "PATCH", body: JSON.stringify({ instructions: instructions || null }) });
										if (post.videoFile && !confirm("Refazer a edição do zero? (pra ajustar a atual, use \"pedir alteração\")")) return;
										void act("edit", () => post$("/edit"), apply);
									}}
								>
									{post.creativeId ? "refazer edição do zero" : "editar com IA"}
								</button>
								{post.takes.some((t) => !["DONE", "FAILED"].includes(t.status)) ? (
									<span className="muted" style={{ fontSize: 12 }}>pode clicar — ela espera os takes terminarem</span>
								) : null}
							</div>
						</Section>
					</div>

					{/* ---------------------------------------------------------- post */}
					<div className="stack" style={{ gap: 12 }}>
						<Section title="Postagem">
							<label className="stack" style={{ gap: 4 }}>
								<span className="muted" style={{ fontSize: 12 }}>conta</span>
								<select value={post.accountId} disabled={locked} onChange={(e) => void patch({ accountId: e.target.value })}>
									{accounts.map((a) => (
										<option key={a.id} value={a.id}>@{a.handle} ({a.platform === "INSTAGRAM" ? "IG" : "TikTok"})</option>
									))}
								</select>
							</label>
							<div className="row" style={{ gap: 8 }}>
								<label className="stack" style={{ gap: 4, flex: 1 }}>
									<span className="muted" style={{ fontSize: 12 }}>dia</span>
									<input type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} onBlur={() => date && time && void patch({ scheduledAt: atSp(date, time).toISOString() })} />
								</label>
								<label className="stack" style={{ gap: 4, flex: 1 }}>
									<span className="muted" style={{ fontSize: 12 }}>horário</span>
									<input type="time" value={time} disabled={locked} onChange={(e) => setTime(e.target.value)} onBlur={() => date && time && void patch({ scheduledAt: atSp(date, time).toISOString() })} />
								</label>
							</div>
							<label className="stack" style={{ gap: 4 }}>
								<span className="muted" style={{ fontSize: 12 }}>título interno (aparece no card)</span>
								<input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== (post.title ?? "") && void patch({ title: title || null })} placeholder="ex: pessoas altas vs baixas" />
							</label>
						</Section>

						<Section title="Legenda do post" right={<span className="muted" style={{ fontSize: 11 }}>{caption.length}/2200</span>}>
							<textarea
								value={caption}
								onChange={(e) => setCaption(e.target.value)}
								onBlur={() => caption !== (post.caption ?? "") && void patch({ caption: caption || null })}
								rows={8}
								disabled={locked}
								maxLength={2200}
								style={{ fontFamily: "inherit", fontSize: 13 }}
								placeholder="a IA escreve na edição se estiver vazia"
							/>
							{post.status === "APPROVED" && caption ? (
								<button style={{ fontSize: 12 }} onClick={() => void navigator.clipboard.writeText(caption).then(() => setNotice("legenda copiada"))}>copiar legenda</button>
							) : null}
						</Section>

						<Section title="Publicação">
							{post.status === "PUBLISHED" ? (
								<div className="stack" style={{ gap: 6 }}>
									<span className="badge" style={{ color: "#22c55e", borderColor: "#22c55e" }}>no ar {post.publishedAt ? `· ${spTime(post.publishedAt)}` : ""}</span>
									{post.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer">abrir o post</a> : null}
								</div>
							) : post.account.platform === "INSTAGRAM" && post.account.connected ? (
								<div className="muted" style={{ fontSize: 12 }}>
									{post.account.autoPublish ? "Depois de aprovado, publica sozinho no horário." : "Auto-publicar está desligado nesta conta: depois de aprovar, use \"postar agora\"."}
								</div>
							) : (
								<div className="stack" style={{ gap: 6 }}>
									<div className="muted" style={{ fontSize: 12 }}>
										{post.account.platform === "TIKTOK" ? "TikTok ainda é manual" : "Conta não conectada"}: aprove, baixe o MP4, poste e marque aqui.
									</div>
									{["APPROVED", "REVIEW"].includes(post.status) ? (
										<button disabled={busy !== null} onClick={() => { const link = prompt("Link do post (opcional)") ?? undefined; void act("mark", () => post$("/mark-published", { permalink: link || undefined }), apply); }}>
											marcar como postado
										</button>
									) : null}
									{post.account.platform === "INSTAGRAM" ? <Link href="/estudio/contas" style={{ fontSize: 12 }}>conectar a conta</Link> : null}
								</div>
							)}
						</Section>

						{post.revisions.length ? (
							<Section title="Alterações pedidas">
								{post.revisions.slice().reverse().map((r) => (
									<div key={r.at} style={{ fontSize: 12 }}>
										<span className="muted">{spTime(r.at)}</span> {r.note}
									</div>
								))}
							</Section>
						) : null}

						{!locked ? (
							<button
								style={{ color: "var(--danger)", fontSize: 12, alignSelf: "flex-start" }}
								onClick={() => { if (confirm("Apagar esta postagem (e os takes dela)?")) void act("del", () => api(`/studio/posts/${id}`, { method: "DELETE" }), () => router.push("/estudio")); }}
							>
								apagar postagem
							</button>
						) : null}
					</div>
				</div>
			</main>
			<style>{`@keyframes pulseBand { 0%,100% { opacity: 1 } 50% { opacity: .55 } } .pulse { animation: pulseBand 1.6s ease-in-out infinite; }
			@media (max-width: 1100px) { main > div[style*="grid"] { grid-template-columns: 1fr !important; } main > div[style*="grid"] > div:first-child { position: static !important; } }`}</style>
		</>
	);
}
