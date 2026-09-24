import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { JobQueue } from "../service/jobs";

const log = { info: () => undefined, error: () => undefined };
async function until(cond: () => boolean): Promise<void> {
	for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
	assert.ok(cond(), "timed out");
}

function deferred() {
	let resolve!: () => void;
	let reject!: (e: Error) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

describe("JobQueue", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ce-jobs-"));
	after(() => rm(dir, { recursive: true, force: true }));

	it("runs at most maxJobs at once, FIFO, with queue positions", async () => {
		const q = new JobQueue({ maxJobs: 1, ttlMs: 0, outDir: dir, log });
		const d1 = deferred();
		const d2 = deferred();
		const started: string[] = [];
		const a = q.enqueue("video", 5000, async (j) => {
			started.push("a");
			await d1.promise;
			j.outPath = q.fileOf(j.id);
		});
		const b = q.enqueue("still", null, async () => {
			started.push("b");
			await d2.promise;
		});
		const c = q.enqueue("video", 1000, async () => {
			started.push("c");
		});
		assert.equal(a.status, "rendering");
		assert.equal(a.position, null);
		assert.equal(b.position, 1);
		assert.equal(c.position, 2);
		assert.deepEqual(q.counts(), { running: 1, queued: 2, total: 3 });
		assert.equal(q.get(a.id)?.durationMs, 5000);
		assert.ok(q.get(a.id)?.startedAt);

		d1.resolve();
		await until(() => q.get(b.id)?.status === "rendering");
		assert.equal(q.get(a.id)?.status, "done");
		assert.equal(q.get(a.id)?.progress, 100);
		assert.ok(q.get(a.id)?.finishedAt);
		assert.equal(q.get(b.id)?.status, "rendering");
		assert.equal(q.get(c.id)?.position, 1);

		d2.reject(new Error("boom"));
		await until(() => q.get(c.id)?.status === "done");
		assert.equal(q.get(b.id)?.status, "failed");
		assert.equal(q.get(b.id)?.error, "boom");
		assert.deepEqual(started, ["a", "b", "c"]);
	});

	it("maxJobs 2 runs two in parallel", () => {
		const q = new JobQueue({ maxJobs: 2, ttlMs: 0, outDir: dir, log });
		const hold = deferred();
		const jobs = [0, 1, 2].map(() => q.enqueue("still", null, () => hold.promise));
		assert.deepEqual(
			jobs.map((j) => j.status),
			["rendering", "rendering", "queued"],
		);
		hold.resolve();
	});

	it("DELETE: 409 while rendering, drops a queued job, removes a finished job and its file", async () => {
		const q = new JobQueue({ maxJobs: 1, ttlMs: 0, outDir: dir, log });
		const hold = deferred();
		const a = q.enqueue("video", 1, async (j) => {
			await hold.promise;
			await writeFile(q.fileOf(j.id) as string, "x");
			j.outPath = q.fileOf(j.id);
		});
		const b = q.enqueue("video", 1, async () => undefined);
		assert.equal(await q.remove(a.id), "rendering");
		assert.equal(await q.remove(b.id), "ok");
		assert.equal(q.get(b.id), undefined);
		hold.resolve();
		await until(() => q.get(a.id)?.status === "done");
		assert.ok((await readdir(dir)).includes(`${a.id}.mp4`));
		assert.equal(await q.remove(a.id), "ok");
		assert.ok(!(await readdir(dir)).includes(`${a.id}.mp4`));
		assert.equal(await q.remove("nope"), "not_found");
	});

	it("sweep prunes expired jobs + files and old orphan files, keeps fresh ones", async () => {
		const q = new JobQueue({ maxJobs: 1, ttlMs: 60_000, outDir: dir, log });
		const a = q.enqueue("still", null, async (j) => {
			await writeFile(q.fileOf(j.id) as string, "x");
			j.outPath = q.fileOf(j.id);
		});
		await until(() => q.get(a.id)?.status === "done");
		const orphanOld = join(dir, "old-orphan.mp4");
		const orphanNew = join(dir, "new-orphan.mp4");
		await writeFile(orphanOld, "x");
		await writeFile(orphanNew, "x");
		const past = new Date(Date.now() - 3600_000);
		await utimes(orphanOld, past, past);

		// "now" = 2 minutes later: job a (finished just now) expired; the new orphan is 2 min old too.
		const r1 = await q.sweep(Date.now() + 30_000);
		assert.deepEqual(r1, { jobs: 0, files: 1 });
		assert.ok(q.get(a.id));
		const r2 = await q.sweep(Date.now() + 120_000);
		assert.equal(r2.jobs, 1);
		assert.equal(q.get(a.id), undefined);
		const left = await readdir(dir);
		assert.ok(!left.includes(`${a.id}.png`));
		assert.ok(!left.includes("old-orphan.mp4"));
	});

	it("ttl 0 never sweeps", async () => {
		const q = new JobQueue({ maxJobs: 1, ttlMs: 0, outDir: dir, log });
		assert.deepEqual(await q.sweep(Date.now() + 1e12), { jobs: 0, files: 0 });
	});
});
