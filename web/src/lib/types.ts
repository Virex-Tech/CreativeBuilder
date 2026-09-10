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
