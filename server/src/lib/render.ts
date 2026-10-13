import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export class RenderStartError extends Error {
	constructor(
		public status: 404 | 409 | 502,
		message: string,
		public detail?: string,
	) {
		super(message);
	}
}

interface StartOptions {
	kind?: "VIDEO" | "STILL";
	frame?: number;
	/** Which version to render. Defaults to the newest. */
	version?: number;
}

/**
 * Creates the RenderJob row and hands the spec to the render service.
 *
 * The RenderJob row here is the record of truth for the team ("what did we render, from
 * which version, and did it work"); the render service only knows about the job it is
 * currently doing. A finished render of the same spec is reused: identical spec, identical
 * output. Stills are cheap and frame-dependent, so only videos are deduplicated.
 */
export async function startRender(creativeId: string, opts: StartOptions = {}) {
	const kind = opts.kind ?? "VIDEO";

	const version = await prisma.creativeVersion.findFirst({
		where: { creativeId, ...(opts.version ? { version: opts.version } : {}) },
		orderBy: { version: "desc" },
	});
	if (!version) throw new RenderStartError(409, "criativo sem versão");

	if (kind === "VIDEO") {
		const done = await prisma.renderJob.findFirst({
			where: { creativeVersionId: version.id, kind: "VIDEO", status: "DONE" },
			orderBy: { createdAt: "desc" },
		});
		if (done) return { job: done, reused: true };
	}

	const job = await prisma.renderJob.create({
		data: { creativeId, creativeVersionId: version.id, kind, frame: opts.frame, status: "QUEUED" },
	});

	const endpoint = kind === "VIDEO" ? "/render" : "/still";
	try {
		const res = await fetch(`${env.RENDER_SERVICE_URL}${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ spec: version.spec, frame: opts.frame ?? 0 }),
		});
		if (!res.ok) throw new Error(`render service ${res.status}: ${await res.text()}`);

		const body = (await res.json()) as { jobId: string };
		const updated = await prisma.renderJob.update({
			where: { id: job.id },
			data: { externalJobId: body.jobId, status: "RUNNING" },
		});

		return { job: updated, reused: false };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await prisma.renderJob.update({
			where: { id: job.id },
			data: { status: "FAILED", error: message, finishedAt: new Date() },
		});
		throw new RenderStartError(502, "falha ao acionar o render", message);
	}
}

/** Downloads a finished render's MP4 from the render service. */
export async function renderFile(renderJobId: string): Promise<Blob> {
	const job = await prisma.renderJob.findUnique({ where: { id: renderJobId } });
	if (!job?.externalJobId || job.status !== "DONE") throw new Error("render não está pronto");

	const res = await fetch(`${env.RENDER_SERVICE_URL}/jobs/${job.externalJobId}/file`);
	if (!res.ok) throw new Error(`arquivo indisponível no render (HTTP ${res.status})`);

	return new Blob([await res.arrayBuffer()], { type: "video/mp4" });
}
