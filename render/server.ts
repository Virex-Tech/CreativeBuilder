import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import Fastify from "fastify";

import { registerAuth } from "./service/auth";
import { loadConfig } from "./service/config";
import { JobQueue } from "./service/jobs";
import { registerPreview } from "./service/preview";
import { getBundle, renderStillFrame, renderVideo } from "./service/renderer";
import { finalizeFootage, type FootageTakeInput } from "./src/footage";
import { creativeSpec, specDurationMs } from "./src/spec";

/**
 * creative-engine — renders a CreativeSpec to MP4/PNG, validates it, finalizes footage edits and
 * serves the browser preview. HTTP contract: README.md ("API HTTP"). Used by CreativeBuilder's
 * server (private network, no token) and by PayPosts (RENDER_TOKEN).
 */

const config = loadConfig();
const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });
const queue = new JobQueue({ maxJobs: config.maxJobs, ttlMs: config.ttlMs, outDir: config.outDir, log: app.log });
const renderOpts = { concurrency: config.concurrency, urlRewrite: config.urlRewrite };

registerAuth(app, config.token);
registerPreview(app, { previewDir: config.previewDir, publicDir: config.publicDir, origins: config.previewOrigins });

const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }): string[] =>
	error.issues.slice(0, 12).map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get("/health", async () => {
	const { running, queued, total } = queue.counts();

	return { ok: true, jobs: total, running, queued };
});

/**
 * Validates a spec against the contract without rendering. Callers store specs written by a
 * model and only this service owns the schema — asking here beats a render failing minutes later.
 */
app.post("/validate", async (request) => {
	const parsed = creativeSpec.safeParse((request.body as { spec?: unknown } | undefined)?.spec);

	return parsed.success ? { ok: true } : { ok: false, issues: issuesOf(parsed.error) };
});

app.post("/render", async (request, reply) => {
	const parsed = creativeSpec.safeParse((request.body as { spec?: unknown } | undefined)?.spec);
	if (!parsed.success) {
		return reply.code(400).send({ error: "invalid spec", issues: parsed.error.issues });
	}
	const spec = parsed.data;

	const job = queue.enqueue("video", specDurationMs(spec), async (j) => {
		const out = queue.fileOf(j.id) as string;
		await renderVideo(spec, out, renderOpts, (p) => {
			j.progress = p;
		});
		j.outPath = out;
	});

	return reply.code(202).send({ jobId: job.id, status: job.status, position: job.position });
});

app.post("/still", async (request, reply) => {
	const body = request.body as { spec?: unknown; frame?: unknown } | undefined;
	const parsed = creativeSpec.safeParse(body?.spec);
	if (!parsed.success) {
		return reply.code(400).send({ error: "invalid spec", issues: parsed.error.issues });
	}
	const frame = typeof body?.frame === "number" && Number.isFinite(body.frame) ? body.frame : 0;
	const spec = parsed.data;

	const job = queue.enqueue("still", null, async (j) => {
		const out = queue.fileOf(j.id) as string;
		await renderStillFrame(spec, frame, out, renderOpts);
		j.outPath = out;
	});

	return reply.code(202).send({ jobId: job.id, status: job.status, position: job.position });
});

app.get<{ Params: { id: string } }>("/jobs/:id", async (request, reply) => {
	const job = queue.get(request.params.id);
	if (!job) return reply.code(404).send({ error: "job not found" });

	return job;
});

app.get<{ Params: { id: string } }>("/jobs/:id/file", async (request, reply) => {
	const { id } = request.params;
	const job = queue.get(id);
	if (!job) {
		// The job table is in memory; after a restart the file may still be on disk (until the TTL
		// sweep). Serve it by id so a caller that already knows the job keeps working.
		if (UUID.test(id)) {
			for (const [ext, type] of [
				["mp4", "video/mp4"],
				["png", "image/png"],
			] as const) {
				const file = join(config.outDir, `${id}.${ext}`);
				if (existsSync(file)) return reply.type(type).send(createReadStream(file));
			}
		}

		return reply.code(404).send({ error: "job not found" });
	}
	if (job.status !== "done" || !job.outPath) {
		return reply.code(409).send({ error: `job is ${job.status}` });
	}

	return reply.type(job.kind === "video" ? "video/mp4" : "image/png").send(createReadStream(job.outPath));
});

/** Removes a job and its file. 409 while it is rendering; a queued job is simply dropped. */
app.delete<{ Params: { id: string } }>("/jobs/:id", async (request, reply) => {
	const result = await queue.remove(request.params.id);
	if (result === "not_found") return reply.code(404).send({ error: "job not found" });
	if (result === "rendering") return reply.code(409).send({ error: "job is rendering" });

	return { ok: true };
});

/**
 * Footage finalize (the single implementation — see src/footage.ts): snaps cuts to words, removes
 * same-take overlaps and rebuilds the auto captions. The caller passes the takes it references.
 */
app.post("/footage/finalize", async (request, reply) => {
	const body = request.body as { spec?: unknown; takes?: unknown } | undefined;
	const spec = body?.spec as { scenes?: unknown } | undefined;
	if (!spec || typeof spec !== "object" || !Array.isArray(spec.scenes)) {
		return reply.code(400).send({ error: "spec inválido: precisa de scenes[]" });
	}
	const takes = body?.takes ?? [];
	if (!Array.isArray(takes)) return reply.code(400).send({ error: "takes deve ser uma lista" });
	const bad = takes.findIndex(
		(t: Partial<FootageTakeInput> | null) =>
			!t ||
			typeof t.id !== "string" ||
			(t.src != null && typeof t.src !== "string") ||
			typeof t.durationMs !== "number" ||
			(t.words != null && !Array.isArray(t.words)),
	);
	if (bad !== -1) {
		return reply.code(400).send({ error: `takes[${String(bad)}] inválido: { id, src, durationMs, words: [{ w, startMs, endMs }] }` });
	}

	return finalizeFootage(spec as Parameters<typeof finalizeFootage>[0], takes as FootageTakeInput[]);
});

async function main(): Promise<void> {
	await mkdir(config.outDir, { recursive: true });
	// Warm the bundle at boot so the first real request is not the slow one.
	getBundle().catch((err: unknown) => app.log.error({ err }, "bundle failed (retried on next render)"));
	// Hourly: drop expired jobs + their files, and orphan files older than the TTL.
	void queue.sweep();
	setInterval(() => void queue.sweep(), 3600_000).unref();
	if (!existsSync(join(config.previewDir, "index.html"))) {
		app.log.warn(`preview not built (${config.previewDir}) — run npm run build:preview`);
	}
	await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err: unknown) => {
	app.log.error(err);
	process.exit(1);
});
