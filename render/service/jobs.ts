import { randomUUID } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export type JobKind = "video" | "still";
export type JobStatus = "queued" | "rendering" | "done" | "failed";

export interface Job {
	id: string;
	kind: JobKind;
	status: JobStatus;
	/** 0–100. */
	progress: number;
	/** Path of the finished file inside the container (set when done). */
	outPath?: string;
	error?: string;
	createdAt: number;
	startedAt?: number;
	finishedAt?: number;
	/** Length of the rendered video in ms (null for a still). */
	durationMs: number | null;
}

/** What `GET /jobs/:id` returns: the job plus its place in the queue (1 = next; null if not queued). */
export type JobView = Job & { position: number | null };

type Work = (job: Job) => Promise<void>;

interface Logger {
	info: (obj: object, msg?: string) => void;
	error: (obj: object, msg?: string) => void;
}

interface Options {
	maxJobs: number;
	/** 0 = keep forever. */
	ttlMs: number;
	outDir: string;
	log: Logger;
}

/**
 * In-memory FIFO render queue with a concurrency cap.
 *
 * Deliberate: the queue of record lives in the caller (CreativeBuilder's BullMQ + RenderJob rows,
 * PayPosts' own table). This service is a worker that happens to speak HTTP; durable job state
 * here would be a second source of truth. If the container restarts, the caller re-enqueues.
 *
 * `maxJobs` exists because every render opens Chrome tabs and an ffmpeg encoder: two callers
 * firing at once would otherwise both run at half speed and risk the container's memory.
 */
export class JobQueue {
	private readonly jobs = new Map<string, Job>();
	/** Internal output file of each job (known before it finishes, so a delete can clean a partial). */
	private readonly files = new Map<string, string>();
	private readonly waiting: { job: Job; work: Work }[] = [];
	private running = 0;

	constructor(private readonly opts: Options) {}

	enqueue(kind: JobKind, durationMs: number | null, work: Work): JobView {
		const job: Job = {
			id: randomUUID(),
			kind,
			status: "queued",
			progress: 0,
			createdAt: Date.now(),
			durationMs,
		};
		this.jobs.set(job.id, job);
		this.files.set(job.id, join(this.opts.outDir, `${job.id}.${kind === "video" ? "mp4" : "png"}`));
		this.waiting.push({ job, work });
		this.pump();

		return this.view(job);
	}

	/** Where a job writes its output. */
	fileOf(id: string): string | undefined {
		return this.files.get(id);
	}

	get(id: string): JobView | undefined {
		const job = this.jobs.get(id);

		return job ? this.view(job) : undefined;
	}

	counts(): { running: number; queued: number; total: number } {
		return { running: this.running, queued: this.waiting.length, total: this.jobs.size };
	}

	/** Removes a job and its file. A running render cannot be removed (it would keep writing). */
	async remove(id: string): Promise<"ok" | "not_found" | "rendering"> {
		const job = this.jobs.get(id);
		if (!job) return "not_found";
		if (job.status === "rendering") return "rendering";

		const i = this.waiting.findIndex((w) => w.job.id === id);
		if (i !== -1) this.waiting.splice(i, 1);
		await this.forget(job);

		return "ok";
	}

	/**
	 * Drops finished jobs older than the TTL (and their files), then deletes files in the output
	 * directory older than the TTL that no live job owns (leftovers from before a restart).
	 */
	async sweep(now = Date.now()): Promise<{ jobs: number; files: number }> {
		if (this.opts.ttlMs <= 0) return { jobs: 0, files: 0 };

		let jobs = 0;
		for (const job of Array.from(this.jobs.values())) {
			if (job.finishedAt !== undefined && now - job.finishedAt > this.opts.ttlMs) {
				await this.forget(job);
				jobs++;
			}
		}

		const owned = new Set(Array.from(this.files.values()));
		let files = 0;
		let names: string[] = [];
		try {
			names = await readdir(this.opts.outDir);
		} catch {
			return { jobs, files };
		}
		for (const name of names) {
			const path = join(this.opts.outDir, name);
			if (owned.has(path)) continue;
			try {
				const st = await stat(path);
				if (st.isFile() && now - st.mtimeMs > this.opts.ttlMs) {
					await rm(path, { force: true });
					files++;
				}
			} catch {
				// Raced with another delete; nothing to do.
			}
		}
		if (jobs || files) this.opts.log.info({ jobs, files }, "render sweep");

		return { jobs, files };
	}

	private async forget(job: Job): Promise<void> {
		const file = this.files.get(job.id);
		this.jobs.delete(job.id);
		this.files.delete(job.id);
		if (file) await rm(file, { force: true }).catch(() => undefined);
	}

	private view(job: Job): JobView {
		const i = job.status === "queued" ? this.waiting.findIndex((w) => w.job === job) : -1;

		return { ...job, position: i === -1 ? null : i + 1 };
	}

	private pump(): void {
		while (this.running < this.opts.maxJobs && this.waiting.length > 0) {
			const next = this.waiting.shift();
			if (!next) break;
			const { job, work } = next;
			this.running++;
			job.status = "rendering";
			job.startedAt = Date.now();

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
					this.opts.log.error({ jobId: job.id, err }, "render failed");
				})
				.finally(() => {
					job.finishedAt = Date.now();
					this.running--;
					this.pump();
				});
		}
	}
}
