import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { env } from "@/lib/env";
import { downloadVideo } from "@/lib/fetchVideo";
import { ingestVideo } from "@/lib/ingest";
import { prisma } from "@/lib/prisma";
import { processTake, transcribe } from "@/lib/takes";

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

/**
 * Ingests one queued reference per cycle: download (if it came as a link), then extract the
 * frames + audio the agent reads to write a blueprint. One at a time on purpose — ffmpeg is
 * CPU-heavy and this shares a box with the renderer.
 */
async function reconcileReferencesOnce(): Promise<void> {
	const ref = await prisma.referenceAsset.findFirst({
		where: { status: "QUEUED" },
		orderBy: { createdAt: "asc" },
	});
	if (!ref) return;

	// Claim it before the slow work so a second worker (or the next cycle) skips it.
	await prisma.referenceAsset.update({ where: { id: ref.id }, data: { status: "RUNNING" } });

	try {
		const outDir = join(env.STORAGE_DIR, "references", ref.id);
		await mkdir(outDir, { recursive: true });

		let video = ref.filePath;
		if (!video) {
			if (!ref.sourceUrl) throw new Error("referência sem arquivo nem link");
			video = join(outDir, "source.mp4");
			await downloadVideo(ref.sourceUrl, video);
		}

		const manifest = await ingestVideo(video, outDir);
		// A fala da referência (hook, roteiro) vira texto pra IA — ela não ouve áudio. Não é fatal.
		if (manifest.audioFile) {
			try {
				const t = await transcribe(join(outDir, manifest.audioFile));
				manifest.transcript = { language: t.language, text: t.text };
			} catch (err) {
				console.error(`worker: transcrição da referência ${ref.id} falhou`, err);
			}
		}
		await prisma.referenceAsset.update({
			where: { id: ref.id },
			data: { status: "DONE", manifest: manifest as object, error: null },
		});
		console.log(`worker: referência ${ref.id} pronta (${manifest.frames.length} frames)`);
	} catch (err) {
		await prisma.referenceAsset.update({
			where: { id: ref.id },
			data: { status: "FAILED", error: err instanceof Error ? err.message : "ingestão falhou" },
		});
		console.error(`worker: referência ${ref.id} falhou`, err);
	}
}

/**
 * Takes do estúdio: um por vez (ffmpeg + whisper disputam CPU com o render). Roda num laço
 * próprio pra um take longo não atrasar a checagem dos renders.
 */
async function processTakesOnce(): Promise<boolean> {
	const take = await prisma.take.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
	if (!take) return false;
	await prisma.take.update({ where: { id: take.id }, data: { status: "PROCESSING" } });
	try {
		await processTake(take);
		console.log(`worker: take ${take.id} pronto`);
	} catch (err) {
		await prisma.take
			.update({ where: { id: take.id }, data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "falhou" } })
			.catch(() => undefined); // take apagado no meio
		console.error(`worker: take ${take.id} falhou`, err);
	}

	return true;
}

async function takesLoop(): Promise<void> {
	// Take que ficou PROCESSING num restart do worker volta pra fila.
	await prisma.take.updateMany({ where: { status: "PROCESSING" }, data: { status: "QUEUED" } });
	for (;;) {
		let worked = false;
		try {
			worked = await processTakesOnce();
		} catch (err) {
			console.error("worker: ciclo de takes falhou", err);
		}
		if (!worked) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

async function main(): Promise<void> {
	console.log(`worker: reconciliando render jobs + referências + takes a cada ${POLL_MS}ms`);
	void takesLoop();

	for (;;) {
		try {
			await reconcileOnce();
		} catch (err) {
			console.error("worker: ciclo de render falhou", err);
		}
		try {
			await reconcileReferencesOnce();
		} catch (err) {
			console.error("worker: ciclo de referência falhou", err);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
