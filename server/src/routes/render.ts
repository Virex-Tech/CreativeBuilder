import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { RenderStartError, startRender } from "@/lib/render";

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
 * Render is delegated to render over HTTP (see lib/render.ts). The RenderJob row is the record
 * of truth; that separation is why the render container can be restarted or replaced without
 * losing history.
 */
export async function renderRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	app.post<{ Params: { id: string } }>("/creatives/:id/render", async (request, reply) => {
		const parsed = renderSchema.safeParse(request.body ?? {});
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const creative = await prisma.creative.findUnique({ where: { id: request.params.id } });
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		try {
			const out = await startRender(creative.id, parsed.data);
			if (out.reused) return out;

			return reply.code(202).send(out);
		} catch (err) {
			if (err instanceof RenderStartError) {
				return reply.code(err.status).send({ error: err.message, ...(err.detail ? { detail: err.detail } : {}) });
			}
			throw err;
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
