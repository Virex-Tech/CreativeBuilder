import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * Background reconciler for render jobs.
 *
 * The API also refreshes a job when someone asks for it, which covers the case of a user
 * staring at the screen. This exists for everything else: a render that finishes while
 * nobody is looking still has to land in the database, or the creative sits "RUNNING"
 * forever and the UI shows a lie.
 *
 * Polling rather than callbacks, deliberately: the render service keeps no durable state,
 * so after a restart there is nothing left to fire a webhook from. Asking always works.
 */

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
/** A render that has not moved in this long is treated as lost, not as still working. */
const STALE_MS = Number(process.env.WORKER_STALE_MS ?? 30 * 60 * 1000);

interface RemoteJob {
	status: "queued" | "rendering" | "done" | "failed";
	progress: number;
	error?: string;
	outPath?: string;
}

async function reconcileOnce(): Promise<void> {
	const jobs = await prisma.renderJob.findMany({
		where: { status: { in: ["QUEUED", "RUNNING"] }, externalJobId: { not: null } },
		orderBy: { createdAt: "asc" },
		take: 50,
	});

	for (const job of jobs) {
		const age = Date.now() - job.createdAt.getTime();

		try {
			const res = await fetch(`${env.RENDER_SERVICE_URL}/jobs/${job.externalJobId}`);

			// A 404 means the render service restarted and lost the job. Nothing is coming.
			if (res.status === 404) {
				await fail(job.id, "render service perdeu o job (provável restart)");
				continue;
			}
			if (!res.ok) continue;

			const remote = (await res.json()) as RemoteJob;

			if (remote.status === "done") {
				await prisma.renderJob.update({
					where: { id: job.id },
					data: {
						status: "DONE",
						progress: 100,
						outputPath: remote.outPath,
						finishedAt: new Date(),
						durationMs: age,
					},
				});
				continue;
			}

			if (remote.status === "failed") {
				await fail(job.id, remote.error ?? "render falhou");
				continue;
			}

			if (remote.progress !== job.progress) {
				await prisma.renderJob.update({
					where: { id: job.id },
					data: { status: "RUNNING", progress: remote.progress },
				});
			}
		} catch {
			// Unreachable render service is not a failed job — it may be restarting. Only the
			// staleness check below decides that something is truly lost.
			if (age > STALE_MS) await fail(job.id, `sem resposta há ${Math.round(age / 60000)}min`);
		}
	}
}

async function fail(id: string, error: string): Promise<void> {
	await prisma.renderJob.update({
		where: { id },
		data: { status: "FAILED", error, finishedAt: new Date() },
	});
}

async function main(): Promise<void> {
	console.log(`worker: reconciliando render jobs a cada ${POLL_MS}ms`);

	for (;;) {
		try {
			await reconcileOnce();
		} catch (err) {
			console.error("worker: ciclo falhou", err);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
