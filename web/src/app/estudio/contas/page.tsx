"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { StudioNav } from "@/components/StudioNav";
import { api } from "@/lib/api";
import type { AppRow, SocialAccountRow, StudioStatus } from "@/lib/types";

/**
 * Contas do estúdio: qualquer conta (marca, criador UGC, persona). Cada uma diz quem fala,
 * como editar, em que horários posta e de onde vêm os takes — e conecta o Instagram pra
 * publicar sozinha.
 */

interface Form {
	appId: string;
	platform: "INSTAGRAM" | "TIKTOK";
	handle: string;
	slotTimes: string;
	persona: string;
	style: string;
	driveFolder: string;
	autoPublish: boolean;
	active: boolean;
}

const empty: Form = {
	appId: "",
	platform: "INSTAGRAM",
	handle: "",
	slotTimes: "09:30, 12:00, 18:00",
	persona: "",
	style: "",
	driveFolder: "",
	autoPublish: true,
	active: true,
};

const toForm = (a: SocialAccountRow): Form => ({
	appId: a.appId,
	platform: a.platform,
	handle: a.handle,
	slotTimes: a.slotTimes.join(", "),
	persona: a.persona ?? "",
	style: a.style ?? "",
	driveFolder: a.driveFolder ?? "",
	autoPublish: a.autoPublish,
	active: a.active,
});

const toBody = (f: Form) => ({
	appId: f.appId,
	platform: f.platform,
	handle: f.handle,
	slotTimes: f.slotTimes
		.split(/[,\s]+/)
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => (/^\d:\d\d$/.test(t) ? `0${t}` : t)),
	persona: f.persona || null,
	style: f.style || null,
	driveFolder: f.driveFolder || null,
	autoPublish: f.autoPublish,
	active: f.active,
});

function AccountForm({
	value,
	apps,
	onChange,
}: {
	value: Form;
	apps: AppRow[];
	onChange: (f: Form) => void;
}) {
	const set = (patch: Partial<Form>) => onChange({ ...value, ...patch });

	return (
		<div className="stack" style={{ gap: 10 }}>
			<div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
				<label className="stack" style={{ gap: 4, flex: "1 1 160px" }}>
					<span className="muted" style={{ fontSize: 12 }}>@ da conta</span>
					<input value={value.handle} onChange={(e) => set({ handle: e.target.value })} placeholder="brendamachadoi" />
				</label>
				<label className="stack" style={{ gap: 4, flex: "0 1 150px" }}>
					<span className="muted" style={{ fontSize: 12 }}>rede</span>
					<select value={value.platform} onChange={(e) => set({ platform: e.target.value as Form["platform"] })}>
						<option value="INSTAGRAM">Instagram</option>
						<option value="TIKTOK">TikTok (manual por enquanto)</option>
					</select>
				</label>
				<label className="stack" style={{ gap: 4, flex: "1 1 160px" }}>
					<span className="muted" style={{ fontSize: 12 }}>app que divulga</span>
					<select value={value.appId} onChange={(e) => set({ appId: e.target.value })}>
						<option value="">escolha…</option>
						{apps.map((a) => (
							<option key={a.id} value={a.id}>{a.name}</option>
						))}
					</select>
				</label>
			</div>
			<label className="stack" style={{ gap: 4 }}>
				<span className="muted" style={{ fontSize: 12 }}>horários do dia (separados por vírgula) — cada um vira uma vaga no calendário</span>
				<input value={value.slotTimes} onChange={(e) => set({ slotTimes: e.target.value })} placeholder="09:30, 11:45, 15:45, 17:45" />
			</label>
			<label className="stack" style={{ gap: 4 }}>
				<span className="muted" style={{ fontSize: 12 }}>quem é a conta e como fala (vai em toda edição)</span>
				<textarea
					value={value.persona}
					onChange={(e) => set({ persona: e.target.value })}
					rows={3}
					style={{ fontFamily: "inherit", fontSize: 13 }}
					placeholder="Brenda, 27, treina há 3 anos, fala direto com a câmera, tom de amiga, sem termo técnico…"
				/>
			</label>
			<label className="stack" style={{ gap: 4 }}>
				<span className="muted" style={{ fontSize: 12 }}>estilo de edição padrão</span>
				<textarea
					value={value.style}
					onChange={(e) => set({ style: e.target.value })}
					rows={3}
					style={{ fontFamily: "inherit", fontSize: 13 }}
					placeholder="cortes secos a cada 1–2s, legenda grande no meio, hook escrito no topo, 15–25s, sem música…"
				/>
			</label>
			<label className="stack" style={{ gap: 4 }}>
				<span className="muted" style={{ fontSize: 12 }}>pasta do Google Drive com os takes (opcional, compartilhada com &quot;qualquer pessoa com o link&quot;)</span>
				<input value={value.driveFolder} onChange={(e) => set({ driveFolder: e.target.value })} placeholder="https://drive.google.com/drive/folders/…" />
			</label>
			<div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
				<label className="row" style={{ gap: 6, width: "auto" }}>
					<input type="checkbox" checked={value.autoPublish} onChange={(e) => set({ autoPublish: e.target.checked })} style={{ width: "auto" }} />
					<span style={{ fontSize: 13 }}>publicar sozinho no horário depois de aprovado</span>
				</label>
				<label className="row" style={{ gap: 6, width: "auto" }}>
					<input type="checkbox" checked={value.active} onChange={(e) => set({ active: e.target.checked })} style={{ width: "auto" }} />
					<span style={{ fontSize: 13 }}>ativa (aparece no calendário)</span>
				</label>
			</div>
		</div>
	);
}

function Connect({ account, status, onDone }: { account: SocialAccountRow; status: StudioStatus | null; onDone: () => Promise<void> }) {
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [showToken, setShowToken] = useState(false);

	if (account.platform !== "INSTAGRAM") {
		return <div className="muted" style={{ fontSize: 12 }}>TikTok: por enquanto você baixa o MP4 aprovado e marca como postado.</div>;
	}

	async function oauth() {
		setBusy(true);
		setErr(null);
		try {
			const { url } = await api<{ url: string }>(`/studio/accounts/${account.id}/instagram/connect`, { method: "POST" });
			window.location.href = url;
		} catch (e) {
			setErr(e instanceof Error ? e.message : "falhou");
			setBusy(false);
		}
	}

	async function paste() {
		setBusy(true);
		setErr(null);
		try {
			await api(`/studio/accounts/${account.id}/instagram/token`, { method: "POST", body: JSON.stringify({ accessToken: token }) });
			setToken("");
			setShowToken(false);
			await onDone();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "token recusado");
		} finally {
			setBusy(false);
		}
	}

	async function disconnect() {
		if (!confirm(`Desconectar @${account.igUsername ?? account.handle}? Postagens agendadas passam a ser manuais.`)) return;
		await api(`/studio/accounts/${account.id}/instagram/disconnect`, { method: "POST" });
		await onDone();
	}

	if (account.connected) {
		const days = account.tokenExpiresAt ? Math.round((new Date(account.tokenExpiresAt).getTime() - Date.now()) / 86400000) : null;

		return (
			<div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
				<span className="badge accent">Instagram conectado · @{account.igUsername}</span>
				{days !== null ? <span className="muted" style={{ fontSize: 12 }}>token renova sozinho (vence em {days} dias)</span> : null}
				<button onClick={() => void disconnect()} style={{ fontSize: 12, padding: "4px 10px" }}>desconectar</button>
			</div>
		);
	}

	return (
		<div className="stack" style={{ gap: 8 }}>
			<div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
				<span className="badge" style={{ color: "#ffb020", borderColor: "#ffb020" }}>não conectada — aprova, mas não publica sozinha</span>
				{status?.instagramOauth ? (
					<button className="primary" onClick={() => void oauth()} disabled={busy}>conectar com o Instagram</button>
				) : null}
				<button onClick={() => setShowToken(!showToken)} style={{ fontSize: 12 }}>colar token</button>
			</div>
			{showToken ? (
				<div className="stack" style={{ gap: 6 }}>
					<span className="muted" style={{ fontSize: 12 }}>
						Painel da Meta → seu app → Instagram → &quot;Gerar token&quot; da conta (precisa ser conta Profissional e estar como testadora do app).
					</span>
					<div className="row" style={{ gap: 8 }}>
						<input value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" />
						<button onClick={() => void paste()} disabled={busy || token.length < 20}>salvar</button>
					</div>
				</div>
			) : null}
			{err ? <div style={{ color: "var(--danger)", fontSize: 12 }}>{err}</div> : null}
		</div>
	);
}

function AccountsInner() {
	const params = useSearchParams();
	const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
	const [apps, setApps] = useState<AppRow[]>([]);
	const [status, setStatus] = useState<StudioStatus | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
	const [form, setForm] = useState<Form>(empty);
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const [a, ap, st] = await Promise.all([
			api<SocialAccountRow[]>("/studio/accounts"),
			api<AppRow[]>("/apps"),
			api<StudioStatus>("/studio/status"),
		]);
		setAccounts(a);
		setApps(ap);
		setStatus(st);
	}, []);

	useEffect(() => {
		void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "falha ao carregar"));
	}, [load]);

	const igResult = params.get("ig");

	async function save(id: string | null) {
		setBusy(true);
		setError(null);
		try {
			if (!form.appId) throw new Error("escolha o app que a conta divulga");
			if (!form.handle.trim()) throw new Error("falta o @ da conta");
			await api(id ? `/studio/accounts/${id}` : "/studio/accounts", {
				method: id ? "PATCH" : "POST",
				body: JSON.stringify(toBody(form)),
			});
			setEditing(null);
			setAdding(false);
			setForm(empty);
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "falha ao salvar");
		} finally {
			setBusy(false);
		}
	}

	async function remove(a: SocialAccountRow) {
		if (!confirm(`Apagar @${a.handle} e TODAS as postagens dela? Não dá pra desfazer.`)) return;
		await api(`/studio/accounts/${a.id}`, { method: "DELETE" });
		await load();
	}

	return (
		<>
			<StudioNav />
			<main style={{ padding: "20px 24px 60px", maxWidth: 900, margin: "0 auto" }} className="stack">
				<div className="row" style={{ justifyContent: "space-between" }}>
					<h1 style={{ margin: 0, fontSize: 26 }}>Contas</h1>
					{!adding ? (
						<button className="primary" onClick={() => { setAdding(true); setEditing(null); setForm({ ...empty, appId: apps[0]?.id ?? "" }); }}>
							+ adicionar conta
						</button>
					) : null}
				</div>

				{igResult === "ok" ? <div className="badge accent" style={{ padding: "8px 12px" }}>Instagram conectado.</div> : null}
				{igResult === "erro" ? (
					<div style={{ color: "var(--danger)" }}>Não conectou: {params.get("msg") ?? "erro desconhecido"}</div>
				) : null}
				{error ? <div style={{ color: "var(--danger)" }}>{error}</div> : null}

				{status && !status.ai ? (
					<div className="panel" style={{ padding: 12, borderColor: "#ffb020", fontSize: 13 }}>
						A IA do servidor não está conectada — a edição não roda até conectar o Codex (em Apps & anúncios).
					</div>
				) : null}

				{adding ? (
					<div className="panel stack" style={{ padding: 16 }}>
						<strong>Nova conta</strong>
						<AccountForm value={form} apps={apps} onChange={setForm} />
						<div className="row">
							<button className="primary" onClick={() => void save(null)} disabled={busy}>salvar</button>
							<button onClick={() => setAdding(false)}>cancelar</button>
						</div>
					</div>
				) : null}

				{accounts.map((a) => (
					<div key={a.id} className="panel stack" style={{ padding: 16, opacity: a.active ? 1 : 0.6 }}>
						<div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
							<div className="row" style={{ gap: 10 }}>
								{a.avatarUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={a.avatarUrl} alt="" width={36} height={36} style={{ borderRadius: 999 }} />
								) : (
									<div style={{ width: 36, height: 36, borderRadius: 999, background: "var(--panel-2)" }} />
								)}
								<div>
									<strong>@{a.handle}</strong>
									<div className="muted" style={{ fontSize: 12 }}>
										{a.platform === "INSTAGRAM" ? "Instagram" : "TikTok"} · {a.app?.name} · {a.slotTimes.length ? a.slotTimes.join(" · ") : "sem horário fixo"}
										{a.active ? "" : " · pausada"}
									</div>
								</div>
							</div>
							<div className="row" style={{ gap: 6 }}>
								<button onClick={() => { setEditing(editing === a.id ? null : a.id); setAdding(false); setForm(toForm(a)); }} style={{ fontSize: 12 }}>
									{editing === a.id ? "fechar" : "editar"}
								</button>
								<button onClick={() => void remove(a)} style={{ fontSize: 12, color: "var(--danger)" }}>apagar</button>
							</div>
						</div>

						<Connect account={a} status={status} onDone={load} />

						{editing === a.id ? (
							<>
								<AccountForm value={form} apps={apps} onChange={setForm} />
								<div className="row">
									<button className="primary" onClick={() => void save(a.id)} disabled={busy}>salvar</button>
								</div>
							</>
						) : a.persona || a.style ? (
							<div className="muted" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
								{[a.persona, a.style].filter(Boolean).join("\n")}
							</div>
						) : null}
					</div>
				))}
			</main>
		</>
	);
}

export default function AccountsPage() {
	// useSearchParams exige Suspense no build estático do Next.
	return (
		<Suspense fallback={null}>
			<AccountsInner />
		</Suspense>
	);
}
