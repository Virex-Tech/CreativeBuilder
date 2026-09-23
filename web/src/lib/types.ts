export interface AppRow {
	id: string;
	name: string;
	slug: string;
	niche: string | null;
	director: Record<string, unknown>;
	brandKit: Record<string, unknown>;
	_count?: { creatives: number; references: number };
}

export interface RenderJob {
	id: string;
	kind: "VIDEO" | "STILL";
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
	progress: number;
	error: string | null;
}

export interface CreativeVersion {
	id: string;
	version: number;
	spec: unknown;
	specHash: string;
	createdBy: string;
	note: string | null;
	createdAt: string;
}

export interface CreativeRow {
	id: string;
	name: string;
	appId: string;
	locale: string;
	status: string;
	mutation: string | null;
	parentId: string | null;
	createdAt: string;
	versions?: { version: number; specHash: string }[];
	renders?: RenderJob[];
	_count?: { children: number };
}

export interface CreativeDetail extends CreativeRow {
	versions: CreativeVersion[];
	renders: RenderJob[];
	children: { id: string; name: string; mutation: string | null }[];
	parent: { id: string; name: string; mutation: string | null } | null;
	app: { id: string; name: string; director: Record<string, unknown>; brandKit: Record<string, unknown> };
}

export interface ReferenceManifest {
	durationSec?: number;
	width?: number | null;
	height?: number | null;
	fps?: number | null;
	hasAudio?: boolean;
	cutCount?: number;
	avgShotSec?: number | null;
	frames?: { index: number; cutAtSec: number; atSec: number; file: string }[];
	audioFile?: string | null;
}

export interface ReferenceRow {
	id: string;
	appId: string;
	sourceUrl: string | null;
	filePath: string | null;
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
	manifest: ReferenceManifest;
	error: string | null;
	createdAt: string;
}

export interface LineageNode {
	id: string;
	name: string;
	mutation: string | null;
	status: string;
	children: LineageNode[];
}

export type PipelineStage =
	| "SPOTTED"
	| "QUEUED"
	| "INGESTING"
	| "GENERATING"
	| "BROLL"
	| "RENDERING"
	| "READY"
	| "DRAFT_QUEUED"
	| "DRAFTED"
	| "FAILED"
	| "DISMISSED";

export interface CompetitorAdRow {
	id: string;
	appId: string;
	source: "trendtrack" | "meta_library" | "manual";
	externalId: string;
	advertiser: string | null;
	pageId: string | null;
	mediaType: string | null;
	thumbnailUrl: string | null;
	daysRunning: number | null;
	reach: number | null;
	content: {
		title?: string | null;
		body?: string | null;
		transcript?: string | null;
		callToAction?: string | null;
		landingPageUrl?: string | null;
		libraryUrl?: string | null;
	};
	stage: PipelineStage;
	error: string | null;
	referenceId: string | null;
	creativeId: string | null;
	renderJobId: string | null;
	meta: { adId: string; creativeId: string; videoId: string; managerUrl: string } | null;
	creative: { id: string; name: string } | null;
	updatedAt: string;
}

export interface PipelineConfig {
	competitors: { name: string; pageId: string }[];
	keywords: string[];
	countries: string[];
	libraryCountries: string[];
	sources: { trendtrack: boolean; metaLibrary: boolean };
	minDaysRunning: number;
	perSource: number;
	locale: string;
	brollProvider?: "kie" | "higgsfield";
	autoRecreate: boolean;
	autoDraft: boolean;
	meta: {
		adsetId?: string;
		pageId?: string;
		instagramUserId?: string;
		link?: string;
		message?: string;
		callToAction: string;
	};
}

export interface PipelineStatus {
	trendtrack: { enabled: boolean; credits: number | null; error: string | null };
	adLibrary: { enabled: boolean };
	ai: { enabled: boolean };
	broll: { providers: string[] };
	meta: { enabled: boolean };
}

export interface LookupHit {
	type: "brandtracker" | "advertiser" | "shop";
	matchType: "exact" | "fuzzy";
	score: number;
	advertiser?: { id: string; name: string; facebookPageId?: string } | null;
	brandtracker?: { id: string; name: string; facebookPageId?: string } | null;
	shop?: { id: string; domain?: string; name?: string } | null;
}
