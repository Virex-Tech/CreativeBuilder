import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import Fastify from "fastify";

import { creativeSpec, type CreativeSpec } from "./src/spec";

const PORT = Number(process.env.PORT ?? 11100);
const OUT_DIR = resolve(process.env.RENDER_OUT_DIR ?? "out");
const CONCURRENCY = process.env.RENDER_CONCURRENCY
	? Number(process.env.RENDER_CONCURRENCY)
	: null;

type JobStatus = "queued" | "rendering" | "done" | "failed";

interface Job {
	id: string;
	kind: "video" | "still";
	status: JobStatus;
	progress: number;
	outPath?: string;
	error?: string;
	createdAt: number;
	finishedAt?: number;
}

/**
 * In-memory job table.
 *
 * Deliberate: the queue of record lives in the API (BullMQ). This service is a worker that
 * happens to speak HTTP, and duplicating durable job state here would create two sources of
 * truth about what is rendering. If the container restarts, the API re-enqueues.
 */
const jobs = new Map<string, Job>();

const app = Fastify({ logger: true });

/**
 * The bundle is built ONCE and reused for every render.
 *
 * Bundling is the slow part (tens of seconds); doing it per request would dominate render
 * time. It is cached as a promise so concurrent first requests share one build instead of
 * racing to produce several.
 */
let bundlePromise: Promise<string> | null = null;

function getBundle(): Promise<string> {
	bundlePromise ??= bundle({
		entryPoint: resolve("src/index.ts"),
		onProgress: () => undefined,
	});

	return bundlePromise;
}

async function resolveComposition(spec: CreativeSpec) {
	const serveUrl = await getBundle();

	// calculateMetadata in Root.tsx derives width/height/fps/duration from the spec, so the
	// composition is resolved per request rather than assumed.
	const composition = await selectComposition({
		serveUrl,
		id: "Creative",
		inputProps: { spec },
	});

	return { serveUrl, composition };
}

async function runVideo(job: Job, spec: CreativeSpec): Promise<void> {
	const { serveUrl, composition } = await resolveComposition(spec);
	const outPath = join(OUT_DIR, `${job.id}.mp4`);

	job.status = "rendering";
	await renderMedia({
		serveUrl,
		composition,
		codec: "h264",
		outputLocation: outPath,
		inputProps: { spec },
		concurrency: CONCURRENCY,
		onProgress: ({ progress }) => {
			job.progress = Math.round(progress * 100);
		},
	});

	job.outPath = outPath;
}

async function runStill(job: Job, spec: CreativeSpec, frame: number): Promise<void> {
	const { serveUrl, composition } = await resolveComposition(spec);
	const outPath = join(OUT_DIR, `${job.id}.png`);

	job.status = "rendering";
	await renderStill({
		serveUrl,
		composition,
		output: outPath,
		inputProps: { spec },
		frame: Math.min(frame, composition.durationInFrames - 1),
	});

	job.outPath = outPath;
}

function startJob(kind: Job["kind"], work: (job: Job) => Promise<void>): Job {
	const job: Job = {
		id: randomUUID(),
		kind,
		status: "queued",
		progress: 0,
		createdAt: Date.now(),
	};
	jobs.set(job.id, job);

	// Fire and forget: renders run for minutes and the caller polls. Errors are captured on
	// the job rather than thrown into an unhandled rejection.
	void work(job)
		.then(() => {
			job.status = "done";
			job.progress = 100;
		})
		.catch((err: unknown) => {
			job.status = "failed";
			job.error = err instanceof Error ? err.message : String(err);
			app.log.error({ jobId: job.id, err }, "render failed");
		})
		.finally(() => {
			job.finishedAt = Date.now();
		});

	return job;
}

app.get("/health", async () => ({ ok: true, jobs: jobs.size }));

/**
 * Validates a spec against the contract without rendering. The API stores specs written by a
 * model and only this service owns the schema — asking here beats a render failing minutes later.
 */
app.post("/validate", async (request) => {
	const parsed = creativeSpec.safeParse((request.body as { spec?: unknown })?.spec);

	return parsed.success
		? { ok: true }
		: { ok: false, issues: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`) };
});

app.post("/render", async (request, reply) => {
	const parsed = creativeSpec.safeParse((request.body as { spec?: unknown })?.spec);
	if (!parsed.success) {
		return reply.code(400).send({ error: "invalid spec", issues: parsed.error.issues });
	}

	const job = startJob("video", (j) => runVideo(j, parsed.data));

	return reply.code(202).send({ jobId: job.id, status: job.status });
});

app.post("/still", async (request, reply) => {
	const body = request.body as { spec?: unknown; frame?: number };
	const parsed = creativeSpec.safeParse(body?.spec);
	if (!parsed.success) {
		return reply.code(400).send({ error: "invalid spec", issues: parsed.error.issues });
	}

	const job = startJob("still", (j) => runStill(j, parsed.data, body.frame ?? 0));

	return reply.code(202).send({ jobId: job.id, status: job.status });
});

app.get<{ Params: { id: string } }>("/jobs/:id", async (request, reply) => {
	const job = jobs.get(request.params.id);
	if (!job) return reply.code(404).send({ error: "job not found" });

	return job;
});

app.get<{ Params: { id: string } }>("/jobs/:id/file", async (request, reply) => {
	const job = jobs.get(request.params.id);
	if (!job) return reply.code(404).send({ error: "job not found" });
	if (job.status !== "done" || !job.outPath) {
		return reply.code(409).send({ error: `job is ${job.status}` });
	}

	const { createReadStream } = await import("node:fs");

	return reply
		.type(job.kind === "video" ? "video/mp4" : "image/png")
		.send(createReadStream(job.outPath));
});

async function main(): Promise<void> {
	await mkdir(OUT_DIR, { recursive: true });
	// Warm the bundle at boot so the first real request is not the slow one.
	void getBundle();
	await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err: unknown) => {
	app.log.error(err);
	process.exit(1);
});
