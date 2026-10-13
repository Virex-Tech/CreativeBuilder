import type { PostStatus } from "@/lib/types";

/**
 * Datas do estúdio no fuso de São Paulo (o time e os horários de postagem vivem nele; o Brasil
 * não tem horário de verão, então o offset é fixo em -03:00).
 */
export const TZ = "America/Sao_Paulo";

export const spDate = (d: Date): string =>
	new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const spTime = (d: Date | string): string =>
	new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));

export const atSp = (date: string, time: string): Date => new Date(`${date}T${time}:00-03:00`);

export const addDays = (date: string, n: number): string => spDate(new Date(atSp(date, "12:00").getTime() + n * 86400000));

export const weekday = (date: string): string =>
	new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" }).format(atSp(date, "12:00")).replace(".", "").toUpperCase();

export const dayNum = (date: string): string => date.slice(8, 10);

export const longDay = (date: string): string =>
	new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(atSp(date, "12:00"));

export const WORKING: PostStatus[] = ["QUEUED", "PREPARING", "EDITING", "REVISING", "BROLL", "RENDERING", "PUBLISHING"];

/** Faixa do card (o "REFERÊNCIA" rosa da tela de referência) + cor por status. */
export function band(p: { status: PostStatus; hasReference: boolean; takes: number; takesPending: number }): { label: string; color: string } | null {
	switch (p.status) {
		case "DRAFT":
			if (p.takesPending > 0) return { label: "recebendo takes", color: "#7c8cff" };
			if (p.takes > 0) return { label: `${p.takes} take${p.takes > 1 ? "s" : ""}`, color: "#7c8cff" };

			return p.hasReference ? { label: "referência", color: "#ff2d87" } : null;
		case "QUEUED":
		case "PREPARING":
		case "EDITING":
		case "REVISING":
		case "BROLL":
			return { label: "IA editando", color: "#a855f7" };
		case "RENDERING":
			return { label: "renderizando", color: "#a855f7" };
		case "REVIEW":
			return { label: "aprovar", color: "#ffb020" };
		case "APPROVED":
			return { label: "postar à mão", color: "#38bdf8" };
		case "SCHEDULED":
			return { label: "agendado", color: "#c6f432" };
		case "PUBLISHING":
			return { label: "publicando", color: "#c6f432" };
		case "PUBLISHED":
			return { label: "no ar", color: "#22c55e" };
		case "FAILED":
			return { label: "erro", color: "#ff5a5a" };
		default:
			return null;
	}
}

export const statusText: Record<PostStatus, string> = {
	DRAFT: "rascunho — monte e clique em editar",
	QUEUED: "na fila da edição",
	PREPARING: "esperando os takes/referência terminarem de processar",
	EDITING: "a IA está editando",
	REVISING: "a IA está aplicando a alteração",
	BROLL: "gerando b-roll",
	RENDERING: "renderizando o vídeo",
	REVIEW: "pronto — aprove ou peça alteração",
	APPROVED: "aprovado — poste à mão e marque como postado",
	SCHEDULED: "aprovado — publica sozinho no horário",
	PUBLISHING: "publicando no Instagram",
	PUBLISHED: "no ar",
	FAILED: "parou com erro",
};

export const fmtDur = (ms: number | null): string => (ms ? `${(ms / 1000).toFixed(1)}s` : "—");
