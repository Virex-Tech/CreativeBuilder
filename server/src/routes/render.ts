import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const renderSchema = z.object({
	kind: z.enum(["VIDEO", "STILL"]).default("VIDEO"),
	frame: z.number().int().min(0).optional(),
	/** Which version to render. Defaults to the newest. */
	version: z.number().int().positive().optional(),
});

interface RenderServiceJob {
	id: string;
	status: "queued" | "rendering" | "done" | "failed";
	progress: number;
	error?: string;
	outPath?: string;
}

/**
 * Render is delegated to render over HTTP.
 *
 * The RenderJob row here is the record of truth for the team ("what did we render, from
 * which version, and did it work"); the render service only knows about the job it is
 * currently doing. That separation is why the render container can be restarted or replaced
 * without losing history.
 */
export async function renderRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	app.post<{ Params: { id: string } }>("/creatives/:id/render", async (request, reply) => {
		const parsed = renderSchema.safeParse(request.body ?? {});
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const creative = await prisma.creative.findUnique({ where: { id: request.params.id } });
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		const version = await prisma.creativeVersion.findFirst({
			where: {
				creativeId: creative.id,
				...(parsed.data.version ? { version: parsed.data.version } : {}),
			},
			orderBy: { version: "desc" },
		});
		if (!version) return reply.code(409).send({ error: "criativo sem versão" });

		// A finished render of the same spec is reusable: identical spec, identical output.
		// Stills are cheap and frame-dependent, so only videos are deduplicated.
		if (parsed.data.kind === "VIDEO") {
			const done = await prisma.renderJob.findFirst({
				where: { creativeVersionId: version.id, kind: "VIDEO", status: "DONE" },
				orderBy: { createdAt: "desc" },
			});
			if (done) return { job: done, reused: true };
		}

		const job = await prisma.renderJob.create({
			data: {
				creativeId: creative.id,
				creativeVersionId: version.id,
				kind: parsed.data.kind,
				frame: parsed.data.frame,
				status: "QUEUED",
			},
		});

		const endpoint = parsed.data.kind === "VIDEO" ? "/render" : "/still";
		try {
			const res = await fetch(`${env.RENDER_SERVICE_URL}${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ spec: version.spec, frame: parsed.data.frame ?? 0 }),
			});
			if (!res.ok) throw new Error(`render service ${res.status}: ${await res.text()}`);

			const body = (await res.json()) as { jobId: string };
			const updated = await prisma.renderJob.update({
				where: { id: job.id },
				data: { externalJobId: body.jobId, status: "RUNNING" },
			});

			return reply.code(202).send({ job: updated, reused: false });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await prisma.renderJob.update({
				where: { id: job.id },
				data: { status: "FAILED", error: message, finishedAt: new Date() },
			});

			return reply.code(502).send({ error: "falha ao acionar o render", detail: message });
		}
	});

	/**
	 * Polls the render service and mirrors its state locally.
	 *
	 * Pull rather than a callback: the render service holds no durable state, so if it
	 * restarts mid-job there is nothing to deliver a webhook from. Asking is always safe.
	 */
	app.get<{ Params: { id: string } }>("/render-jobs/:id", async (request, reply) => {
		const job = await prisma.renderJob.findUnique({ where: { id: request.params.id } });
		if (!job) return reply.code(404).send({ error: "job não encontrado" });
		if (job.status === "DONE" || job.status === "FAILED" || !job.externalJobId) return job;

		try {
			const res = await fetch(`${env.RENDER_SERVICE_URL}/jobs/${job.externalJobId}`);
			if (!res.ok) return job;

			const remote = (await res.json()) as RenderServiceJob;
			const status =
				remote.status === "done" ? "DONE" : remote.status === "failed" ? "FAILED" : "RUNNING";

			return prisma.renderJob.update({
				where: { id: job.id },
				data: {
					status,
					progress: remote.progress,
					outputPath: remote.outPath,
					error: remote.error,
					finishedAt: status === "RUNNING" ? null : new Date(),
					durationMs:
						status === "RUNNING" ? null : Date.now() - job.createdAt.getTime(),
				},
			});
		} catch {
			// The render service being unreachable is not the job failing — it may still be
			// working. Report what we know and let the next poll settle it.
			return job;
		}
	});

	/** Streams the finished file straight from the render service. */
	app.get<{ Params: { id: string } }>("/render-jobs/:id/file", async (request, reply) => {
		const job = await prisma.renderJob.findUnique({ where: { id: request.params.id } });
		if (!job?.externalJobId) return reply.code(404).send({ error: "job não encontrado" });
		if (job.status !== "DONE") return reply.code(409).send({ error: `job está ${job.status}` });

		const res = await fetch(`${env.RENDER_SERVICE_URL}/jobs/${job.externalJobId}/file`);
		if (!res.ok || !res.body) {
			return reply.code(502).send({ error: "arquivo indisponível no render" });
		}

		return reply
			.type(job.kind === "VIDEO" ? "video/mp4" : "image/png")
			.send(Buffer.from(await res.arrayBuffer()));
	});
}
