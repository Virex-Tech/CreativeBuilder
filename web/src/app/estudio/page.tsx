"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StudioNav } from "@/components/StudioNav";
import { api } from "@/lib/api";
import { addDays, atSp, band, dayNum, longDay, spDate, spTime, WORKING, weekday } from "@/lib/studio";
import type { CalendarPost, SocialAccountRow } from "@/lib/types";

/**
 * "Hoje": a semana em cima, uma linha por conta, um card por horário. O card mostra em que pé
 * está a postagem (faixa colorida); horário vazio vira um "+" que cria a postagem ali.
 */

interface Calendar {
	accounts: SocialAccountRow[];
	posts: CalendarPost[];
}

const CARD_W = 148;

function PostCard({ post, onClick }: { post: CalendarPost; onClick: () => void }) {
	const b = band(post);
	const working = WORKING.includes(post.status);

	return (
		<button
			onClick={onClick}
			title={post.error ?? post.title ?? ""}
			style={{
				position: "relative",
				width: CARD_W,
				aspectRatio: "9 / 16",
				padding: 0,
				flexShrink: 0,
				overflow: "hidden",
				borderRadius: 14,
				border: `1px solid ${b ? b.color + "88" : "var(--line)"}`,
				background: post.thumbUrl ? `center / cover no-repeat url("${post.thumbUrl}")` : "var(--panel-2)",
				textAlign: "left",
			}}
		>
			<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.45), transparent 30%, transparent 60%, rgba(0,0,0,.75))" }} />
			<span style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(0,0,0,.7)" }}>
				{spTime(post.scheduledAt)}
			</span>
			{post.takes > 0 && post.status === "DRAFT" ? (
				<span style={{ position: "absolute", top: 8, right: 8, fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "rgba(0,0,0,.7)" }}>
					🎬 {post.takes}
				</span>
			) : null}
			{b ? (
				<div
					className={working ? "pulse" : undefined}
					style={{
						position: "absolute",
						left: -30,
						right: -30,
						top: "46%",
						transform: "rotate(-14deg)",
						background: b.color,
						color: "#0b0b0f",
						fontWeight: 900,
						fontSize: 11,
						letterSpacing: 3,
						textAlign: "center",
						textTransform: "uppercase",
						padding: "6px 0",
						boxShadow: "0 6px 18px rgba(0,0,0,.4)",
					}}
				>
					{b.label}
				</div>
			) : null}
			<div style={{ position: "absolute", left: 8, right: 8, bottom: 8, fontSize: 11, lineHeight: 1.3, color: "#fff", textShadow: "0 1px 4px #000" }}>
				{post.status === "FAILED" && post.error ? <span style={{ color: "#ffb4b4" }}>{post.error.slice(0, 70)}</span> : post.title}
			</div>
		</button>
	);
}

function EmptySlot({ time, onClick, busy }: { time: string; onClick: () => void; busy: boolean }) {
	return (
		<button
			onClick={onClick}
			disabled={busy}
			style={{
				width: CARD_W,
				aspectRatio: "9 / 16",
				flexShrink: 0,
				borderRadius: 14,
				border: "1px dashed var(--line)",
				background: "transparent",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 6,
				color: "var(--muted)",
			}}
		>
			<span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
			<span style={{ fontSize: 12 }}>{time}</span>
		</button>
	);
}

export default function StudioToday() {
	const router = useRouter();
	const today = spDate(new Date());
	const [day, setDay] = useState(today);
	const [weekStart, setWeekStart] = useState(today);
	const [cal, setCal] = useState<Calendar | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState<string | null>(null);
	const [customTime, setCustomTime] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		setCal(await api<Calendar>(`/studio/calendar?from=${weekStart}&days=7`));
	}, [weekStart]);

	useEffect(() => {
		void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "falha ao carregar"));
	}, [load]);

	// Enquanto algo estiver andando (IA, render, publicação, takes chegando), atualiza sozinho.
	const live = cal?.posts.some((p) => WORKING.includes(p.status) || p.takesPending > 0);
	useEffect(() => {
		const t = setInterval(() => void load().catch(() => undefined), live ? 4000 : 20000);

		return () => clearInterval(t);
	}, [live, load]);

	const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

	const byDay = useMemo(() => {
		const m = new Map<string, CalendarPost[]>();
		for (const p of cal?.posts ?? []) {
			const k = spDate(new Date(p.scheduledAt));
			m.set(k, [...(m.get(k) ?? []), p]);
		}

		return m;
	}, [cal]);

	const counts = useMemo(() => {
		const posts = cal?.posts ?? [];

		return {
			review: posts.filter((p) => p.status === "REVIEW").length,
			working: posts.filter((p) => WORKING.includes(p.status)).length,
			scheduled: posts.filter((p) => p.status === "SCHEDULED").length,
			failed: posts.filter((p) => p.status === "FAILED").length,
		};
	}, [cal]);

	async function createAt(account: SocialAccountRow, time: string) {
		const key = `${account.id}-${time}`;
		setCreating(key);
		setError(null);
		try {
			const post = await api<{ id: string }>("/studio/posts", {
				method: "POST",
				body: JSON.stringify({ accountId: account.id, scheduledAt: atSp(day, time).toISOString() }),
			});
			router.push(`/estudio/p/${post.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "falha ao criar");
			setCreating(null);
		}
	}

	const dayPosts = byDay.get(day) ?? [];

	return (
		<>
			<StudioNav />
			<main style={{ padding: "20px 24px 60px", maxWidth: 1400, margin: "0 auto" }}>
				<div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
					<div>
						<h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1, margin: 0 }}>{day === today ? "HOJE" : weekday(day)}</h1>
						<div className="muted" style={{ fontSize: 13 }}>{longDay(day)}</div>
					</div>
					<div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
						{counts.review ? <span className="badge" style={{ color: "#ffb020", borderColor: "#ffb020" }}>{counts.review} pra aprovar</span> : null}
						{counts.working ? <span className="badge" style={{ color: "#a855f7", borderColor: "#a855f7" }}>{counts.working} em edição</span> : null}
						{counts.scheduled ? <span className="badge accent">{counts.scheduled} agendados</span> : null}
						{counts.failed ? <span className="badge" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>{counts.failed} com erro</span> : null}
					</div>
				</div>

				{/* Semana */}
				<div className="panel row" style={{ marginTop: 16, padding: 8, gap: 6, overflowX: "auto" }}>
					<button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ padding: "8px 10px" }} aria-label="semana anterior">‹</button>
					{week.map((d) => {
						const n = byDay.get(d)?.length ?? 0;
						const selected = d === day;

						return (
							<button
								key={d}
								onClick={() => setDay(d)}
								style={{
									flex: "1 0 64px",
									padding: "8px 4px",
									textAlign: "center",
									background: selected ? "var(--fg)" : "transparent",
									color: selected ? "var(--bg)" : "var(--fg)",
									border: d === today && !selected ? "1px solid var(--accent)" : "1px solid transparent",
								}}
							>
								<div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>{weekday(d)}</div>
								<div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{dayNum(d)}</div>
								<div style={{ fontSize: 10, opacity: 0.6, minHeight: 12 }}>{n ? `${n} post${n > 1 ? "s" : ""}` : ""}</div>
							</button>
						);
					})}
					<button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ padding: "8px 10px" }} aria-label="próxima semana">›</button>
					{weekStart !== today ? (
						<button onClick={() => { setWeekStart(today); setDay(today); }} style={{ fontSize: 12 }}>hoje</button>
					) : null}
				</div>

				{error ? <div style={{ color: "var(--danger)", marginTop: 12 }}>{error}</div> : null}
				{!cal ? <p className="muted">carregando…</p> : null}

				{cal && cal.accounts.length === 0 ? (
					<div className="panel" style={{ padding: 24, marginTop: 24 }}>
						<strong>Nenhuma conta ainda.</strong>
						<p className="muted" style={{ margin: "6px 0 12px" }}>
							Adicione as contas onde vocês postam (marca, criadores UGC, personas) e os horários de cada uma.
						</p>
						<Link href="/estudio/contas" className="badge accent" style={{ fontSize: 13, padding: "6px 12px" }}>adicionar conta</Link>
					</div>
				) : null}

				{/* Uma linha por conta */}
				<div className="stack" style={{ gap: 28, marginTop: 24 }}>
					{cal?.accounts.map((account) => {
						const posts = dayPosts.filter((p) => p.accountId === account.id);
						const taken = new Set(posts.map((p) => spTime(p.scheduledAt)));
						const free = account.slotTimes.filter((t) => !taken.has(t));
						const slots = [
							...posts.map((p) => ({ time: spTime(p.scheduledAt), post: p })),
							...free.map((t) => ({ time: t, post: null as CalendarPost | null })),
						].sort((a, b) => a.time.localeCompare(b.time));
						const total = Math.max(account.slotTimes.length, posts.length);
						const custom = customTime[account.id] ?? "";

						return (
							<section key={account.id}>
								<div className="row" style={{ gap: 10, marginBottom: 10 }}>
									{account.avatarUrl ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img src={account.avatarUrl} alt="" width={26} height={26} style={{ borderRadius: 999 }} />
									) : null}
									<strong>@{account.handle}</strong>
									<span className="muted" style={{ fontSize: 12 }}>
										{posts.length} de {total}
									</span>
									<span className="badge">{account.platform === "INSTAGRAM" ? "Instagram" : "TikTok"}</span>
									{account.platform === "INSTAGRAM" && !account.connected ? (
										<Link href="/estudio/contas" className="badge" style={{ color: "#ffb020", borderColor: "#ffb020" }}>não conectada</Link>
									) : null}
									{account.app ? <span className="muted" style={{ fontSize: 12 }}>· {account.app.name}</span> : null}
								</div>
								<div className="row" style={{ gap: 12, overflowX: "auto", paddingBottom: 6, alignItems: "stretch" }}>
									{slots.map((s) =>
										s.post ? (
											<PostCard key={s.post.id} post={s.post} onClick={() => router.push(`/estudio/p/${s.post!.id}`)} />
										) : (
											<EmptySlot
												key={`${account.id}-${s.time}`}
												time={s.time}
												busy={creating === `${account.id}-${s.time}`}
												onClick={() => void createAt(account, s.time)}
											/>
										),
									)}
									<div
										style={{ width: CARD_W, flexShrink: 0, borderRadius: 14, border: "1px dashed var(--line)", padding: 12, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}
									>
										<span className="muted" style={{ fontSize: 11 }}>outro horário</span>
										<input
											type="time"
											value={custom}
											onChange={(e) => setCustomTime({ ...customTime, [account.id]: e.target.value })}
										/>
										<button disabled={!custom || creating !== null} onClick={() => void createAt(account, custom)}>
											+ postagem
										</button>
									</div>
								</div>
							</section>
						);
					})}
				</div>
			</main>
			<style>{`@keyframes pulseBand { 0%,100% { opacity: 1 } 50% { opacity: .55 } } .pulse { animation: pulseBand 1.6s ease-in-out infinite; }`}</style>
		</>
	);
}
