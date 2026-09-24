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

// ---------------------------------------------------------------------------------------
// Estúdio de conteúdo
// ---------------------------------------------------------------------------------------

export type PostStatus =
	| "DRAFT"
	| "QUEUED"
	| "PREPARING"
	| "EDITING"
	| "REVISING"
	| "BROLL"
	| "RENDERING"
	| "REVIEW"
	| "APPROVED"
	| "SCHEDULED"
	| "PUBLISHING"
	| "PUBLISHED"
	| "FAILED";

export interface SocialAccountRow {
	id: string;
	appId: string;
	platform: "INSTAGRAM" | "TIKTOK";
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	persona: string | null;
	style: string | null;
	slotTimes: string[];
	timezone: string;
	driveFolder: string | null;
	autoPublish: boolean;
	active: boolean;
	igUserId: string | null;
	igUsername: string | null;
	tokenExpiresAt: string | null;
	connectedAt: string | null;
	connected: boolean;
	app?: { id: string; name: string };
}

export interface CalendarPost {
	id: string;
	accountId: string;
	scheduledAt: string;
	status: PostStatus;
	title: string | null;
	error: string | null;
	permalink: string | null;
	hasReference: boolean;
	takes: number;
	takesPending: number;
	thumbUrl: string | null;
}

export interface TakeRow {
	id: string;
	source: "UPLOAD" | "LINK" | "DRIVE" | "SENDER" | "KIE";
	sourceUrl: string | null;
	originalName: string | null;
	status: "RECEIVING" | "QUEUED" | "GENERATING" | "PROCESSING" | "DONE" | "FAILED";
	error: string | null;
	durationMs: number | null;
	width: number | null;
	height: number | null;
	prompt: string | null;
	sortOrder: number;
	text: string | null;
	videoUrl: string | null;
	thumbUrl: string | null;
	createdAt: string;
}

export interface PostDetail {
	id: string;
	accountId: string;
	appId: string;
	scheduledAt: string;
	status: PostStatus;
	title: string | null;
	instructions: string | null;
	caption: string | null;
	referenceId: string | null;
	creativeId: string | null;
	videoFile: string | null;
	revisionNote: string | null;
	revisions: { at: string; note: string }[];
	approvedAt: string | null;
	permalink: string | null;
	publishedAt: string | null;
	error: string | null;
	updatedAt: string;
	account: SocialAccountRow;
	takes: TakeRow[];
	reference: {
		id: string;
		status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
		error: string | null;
		sourceUrl: string | null;
		durationSec: number | null;
		avgShotSec: number | null;
		transcript: string | null;
		frames: (string | null)[];
	} | null;
	versions: { version: number; note: string | null; createdAt: string; createdBy: string }[];
	render: { id: string; status: string; progress: number; error: string | null } | null;
	videoUrl: string | null;
	posterUrl: string | null;
	uploadUrl: string | null;
}

export interface StudioStatus {
	ai: boolean;
	kie: boolean;
	broll: string[];
	instagramOauth: boolean;
	drive: "api" | "public-page";
	uploadLinks: boolean;
	takeModel: string;
	takeCostUsd: number;
}
