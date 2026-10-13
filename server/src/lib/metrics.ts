/**
 * Fase 5 — análise de performance por CSV (skill `criativo` §6).
 *
 * Enquanto não há integração live com a Meta, o operador exporta um CSV do Gerenciador de
 * Anúncios e a gente cruza com os criativos pelo id ou pelo nome. Calcula as métricas por
 * posição que dizem ONDE o público cai — hook rate (os 2s iniciais), hold rate (corpo e
 * ritmo), CTR (oferta/CTA) e os quartis de retenção.
 *
 * Os nomes de coluna da Meta variam (idioma, config de export), então o casamento de coluna
 * é tolerante e a linha crua é sempre guardada — nenhuma métrica computável é perdida, e o
 * que não der pra calcular fica null em vez de quebrar.
 */

export interface CsvRow {
	[header: string]: string;
}

/** Detecta o separador e faz parse de um CSV com aspas. */
export function parseCsv(text: string): CsvRow[] {
	const clean = text.replace(/^﻿/, "");
	const firstLine = clean.slice(0, clean.indexOf("\n") >= 0 ? clean.indexOf("\n") : clean.length);
	const delim = firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

	const rows: string[][] = [];
	let field = "";
	let record: string[] = [];
	let inQuotes = false;
	for (let i = 0; i < clean.length; i++) {
		const c = clean[i];
		if (inQuotes) {
			if (c === '"') {
				if (clean[i + 1] === '"') {
					field += '"';
					i++;
				} else inQuotes = false;
			} else field += c;
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === delim) {
			record.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && clean[i + 1] === "\n") i++;
			record.push(field);
			field = "";
			if (record.some((f) => f.length > 0)) rows.push(record);
			record = [];
		} else field += c;
	}
	if (field.length > 0 || record.length > 0) {
		record.push(field);
		if (record.some((f) => f.length > 0)) rows.push(record);
	}

	if (rows.length < 2) return [];
	const headers = rows[0].map((h) => h.trim());

	return rows.slice(1).map((r) => {
		const obj: CsvRow = {};
		headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));

		return obj;
	});
}

/** Primeiro valor numérico cuja coluna contém algum dos padrões (case-insensitive). */
function num(row: CsvRow, patterns: string[]): number | null {
	for (const [key, value] of Object.entries(row)) {
		const k = key.toLowerCase();
		if (patterns.some((p) => k.includes(p))) {
			const n = Number(value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
			if (Number.isFinite(n)) return n;
		}
	}

	return null;
}

/** Valor de texto cru da 1ª coluna que casa (para achar o identificador do criativo). */
function str(row: CsvRow, patterns: string[]): string | null {
	for (const [key, value] of Object.entries(row)) {
		if (patterns.some((p) => key.toLowerCase().includes(p))) return value;
	}

	return null;
}

export interface ComputedMetrics {
	impressions: number | null;
	spend: number | null;
	/** os 2s iniciais: 2-sec contínuos ÷ impressões */
	hookRate: number | null;
	/** corpo/ritmo: p75 ÷ plays */
	holdRate: number | null;
	/** oferta/CTA: cliques (outbound/link) ÷ impressões */
	ctr: number | null;
	quartiles: { p25: number | null; p50: number | null; p75: number | null; p95: number | null };
	raw: CsvRow;
}

/** Extrai e calcula as métricas por posição de uma linha do CSV. */
export function computeMetrics(row: CsvRow): ComputedMetrics {
	const impressions = num(row, ["impress", "impressõ", "impressoe"]);
	const spend = num(row, ["amount spent", "valor gasto", "valor usado", "spend", "gasto"]);
	const clicks = num(row, [
		"outbound click",
		"cliques de saída",
		"cliques de saida",
		"link click",
		"cliques no link",
		"clicks (all)",
		"cliques (todos",
	]);
	const twoSec = num(row, [
		"2-second continuous",
		"2-second",
		"2 sec",
		"2s cont",
		"contínuas de 2",
		"continuas de 2",
		"reproduções contínuas de v",
		"reproducoes continuas de v",
		"thruplay", // fallback: ThruPlays aproxima o engajamento inicial quando não há 2s
	]);
	const plays = num(row, [
		"video plays",
		"reproduções de vídeo",
		"reproducoes de video",
		"video_play",
		"plays de v",
		"3-second video plays",
		"reproduções de vídeo de 3 s",
	]);
	const p25 = num(row, ["25%"]);
	const p50 = num(row, ["50%"]);
	const p75 = num(row, ["75%"]);
	const p95 = num(row, ["95%", "100%"]);

	const ratio = (a: number | null, b: number | null): number | null =>
		a !== null && b !== null && b > 0 ? Number((a / b).toFixed(4)) : null;

	return {
		impressions,
		spend,
		hookRate: ratio(twoSec, impressions),
		holdRate: ratio(p75, plays),
		ctr: ratio(clicks, impressions),
		quartiles: { p25, p50, p75, p95 },
		raw: row,
	};
}

/** Identificador que amarra a linha a um criativo (id uuid ou nome do anúncio). */
export function rowIdentifier(row: CsvRow): string | null {
	return (
		str(row, ["ad name", "nome do anúncio", "nome do anuncio", "creative", "criativo", "anúncio", "anuncio"]) ??
		Object.values(row)[0] ??
		null
	);
}
