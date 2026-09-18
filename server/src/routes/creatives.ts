import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
	isSpec,
	mergeSpec,
	reflow,
	specDurationMs,
	specHash,
	validateSpec,
	type Spec,
} from "@/lib/spec";
import { adjustSpec, agentDisabledMessage, agentEnabled, authorSpec } from "@/lib/specAuthor";

const createSchema = z.object({
	appId: z.string().uuid(),
	name: z.string().min(1),
	spec: z.unknown(),
	templateId: z.string().uuid().optional(),
	locale: z.string().default("pt-BR"),
});

const patchSchema = z.object({
	patch: z.record(z.unknown()),
	note: z.string().optional(),
	createdBy: z.enum(["human", "ai"]).default("human"),
});

const variationSchema = z.object({
	mutation: z.string().min(1),
	patch: z.record(z.unknown()),
	name: z.string().optional(),
});

const generateSchema = z.object({
	appId: z.string().uuid(),
	name: z.string().min(1),
	locale: z.string().default("pt-BR"),
	brief: z.string().optional(),
	referenceId: z.string().uuid().optional(),
});

const adjustSchema = z.object({ instruction: z.string().min(1) });

/** Loads a creative with its newest version, or null. */
async function latestVersion(creativeId: string) {
	return prisma.creativeVersion.findFirst({
		where: { creativeId },
		orderBy: { version: "desc" },
	});
}

/** Field-level diff, recursing into arrays and keying scenes by id, so a change reads as
 * "scenes[hook].durationMs: 2400 → 1800" instead of a dumped array. */
function diff(a: unknown, b: unknown, path = ""): { path: string; from: unknown; to: unknown }[] {
	const changes: { path: string; from: unknown; to: unknown }[] = [];

	const label = (item: unknown, i: number): string | number =>
		item && typeof item === "object" && "id" in item ? String((item as { id: string }).id) : i;

	const walk = (x: unknown, y: unknown, p: string): void => {
		if (Array.isArray(x) && Array.isArray(y)) {
			for (let i = 0; i < Math.max(x.length, y.length); i++) {
				walk(x[i], y[i], `${p}[${String(label(x[i] ?? y[i], i))}]`);
			}

			return;
		}
		if (x && y && typeof x === "object" && typeof y === "object") {
			const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
			for (const k of keys) {
				walk(
					(x as Record<string, unknown>)[k],
					(y as Record<string, unknown>)[k],
					p ? `${p}.${k}` : k,
				);
			}

			return;
		}
		if (JSON.stringify(x) !== JSON.stringify(y)) changes.push({ path: p, from: x, to: y });
	};

	walk(a, b, path);

	return changes;
}

export async function creativeRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	app.get<{ Querystring: { appId?: string } }>("/creatives", async (request) => {
		const creatives = await prisma.creative.findMany({
			where: request.query.appId ? { appId: request.query.appId } : undefined,
			orderBy: { createdAt: "desc" },
			include: {
				versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, specHash: true } },
				renders: { orderBy: { createdAt: "desc" }, take: 1 },
				_count: { select: { children: true } },
			},
		});

		return creatives;
	});

	app.post("/creatives", async (request, reply) => {
		const parsed = createSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
		if (!isSpec(parsed.data.spec)) return reply.code(400).send({ error: "spec inválido" });

		const targetApp = await prisma.app.findUnique({ where: { id: parsed.data.appId } });
		if (!targetApp) return reply.code(404).send({ error: "app não encontrado" });

		const spec = reflow(parsed.data.spec);
		const issues = validateSpec(spec, targetApp.director as Record<string, unknown>);
		if (issues.errors.length) return reply.code(422).send({ error: "spec inválido", issues });

		const creative = await prisma.creative.create({
			data: {
				appId: parsed.data.appId,
				userId: request.user.sub,
				templateId: parsed.data.templateId,
				name: parsed.data.name,
				locale: parsed.data.locale,
				mutation: "seed",
				versions: {
					create: { version: 1, spec: spec as object, specHash: specHash(spec) },
				},
			},
			include: { versions: true },
		});

		return reply.code(201).send({ creative, issues });
	});

	/**
	 * Gera um criativo do zero com a IA (Fase 2), a partir de um brief e/ou uma referência
	 * ingerida. Inerte sem ANTHROPIC_API_KEY: responde 503 com instrução.
	 */
	app.post("/creatives/generate", async (request, reply) => {
		if (!agentEnabled()) {
			return reply.code(503).send({ error: agentDisabledMessage("geração") });
		}
		const parsed = generateSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const targetApp = await prisma.app.findUnique({ where: { id: parsed.data.appId } });
		if (!targetApp) return reply.code(404).send({ error: "app não encontrado" });

		let referenceManifest: Record<string, unknown> | undefined;
		if (parsed.data.referenceId) {
			const ref = await prisma.referenceAsset.findUnique({ where: { id: parsed.data.referenceId } });
			if (!ref) return reply.code(404).send({ error: "referência não encontrada" });
			if (ref.status !== "DONE") return reply.code(409).send({ error: `referência ainda ${ref.status}` });
			referenceManifest = ref.manifest as Record<string, unknown>;
		}

		let result;
		try {
			result = await authorSpec({
				app: {
					id: targetApp.id,
					name: targetApp.name,
					director: targetApp.director as Record<string, unknown>,
					brandKit: targetApp.brandKit as Record<string, unknown>,
				},
				name: parsed.data.name,
				locale: parsed.data.locale,
				brief: parsed.data.brief,
				referenceId: parsed.data.referenceId,
				referenceManifest,
				storageDir: env.STORAGE_DIR,
			});
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha na geração" });
		}
		if (result.issues.errors.length) {
			return reply.code(422).send({ error: "IA gerou spec inválido", issues: result.issues });
		}

		const creative = await prisma.creative.create({
			data: {
				appId: targetApp.id,
				userId: request.user.sub,
				name: parsed.data.name,
				locale: parsed.data.locale,
				mutation: "ai_generate",
				versions: {
					create: {
						version: 1,
						spec: result.spec as object,
						specHash: specHash(result.spec),
						createdBy: "ai",
					},
				},
			},
			include: { versions: true },
		});

		return reply.code(201).send({ creative, issues: result.issues });
	});

	/** Ajusta um criativo existente em linguagem natural (Fase 2), gravando nova versão. */
	app.post<{ Params: { id: string } }>("/creatives/:id/adjust", async (request, reply) => {
		if (!agentEnabled()) {
			return reply.code(503).send({ error: agentDisabledMessage("ajuste") });
		}
		const parsed = adjustSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const creative = await prisma.creative.findUnique({
			where: { id: request.params.id },
			include: { app: { select: { director: true, brandKit: true } } },
		});
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		const current = await latestVersion(creative.id);
		if (!current) return reply.code(409).send({ error: "criativo sem versão" });

		let result;
		try {
			result = await adjustSpec(
				current.spec as unknown as Spec,
				parsed.data.instruction,
				creative.app.director as Record<string, unknown>,
				creative.app.brandKit as Record<string, unknown>,
			);
		} catch (err) {
			return reply.code(502).send({ error: err instanceof Error ? err.message : "falha no ajuste" });
		}
		if (result.issues.errors.length) {
			return reply.code(422).send({ error: "IA gerou spec inválido", issues: result.issues });
		}

		const hash = specHash(result.spec);
		if (hash === current.specHash) {
			return { unchanged: true, version: current.version, issues: result.issues, changes: [] };
		}

		const version = await prisma.creativeVersion.create({
			data: {
				creativeId: creative.id,
				version: current.version + 1,
				spec: result.spec as object,
				specHash: hash,
				createdBy: "ai",
				note: parsed.data.instruction,
			},
		});

		return { version, issues: result.issues, durationMs: specDurationMs(result.spec) };
	});

	app.get<{ Params: { id: string } }>("/creatives/:id", async (request, reply) => {
		const creative = await prisma.creative.findUnique({
			where: { id: request.params.id },
			include: {
				versions: { orderBy: { version: "desc" } },
				renders: { orderBy: { createdAt: "desc" }, take: 10 },
				children: { select: { id: true, name: true, mutation: true, createdAt: true } },
				parent: { select: { id: true, name: true, mutation: true } },
				app: { select: { id: true, name: true, director: true, brandKit: true } },
			},
		});
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		return creative;
	});

	/**
	 * Appends a new version. Specs are never edited in place — that is what makes
	 * "what did this look like when it performed" answerable months later.
	 */
	app.patch<{ Params: { id: string } }>("/creatives/:id/spec", async (request, reply) => {
		const parsed = patchSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const creative = await prisma.creative.findUnique({
			where: { id: request.params.id },
			include: { app: { select: { director: true } } },
		});
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		const current = await latestVersion(creative.id);
		if (!current) return reply.code(409).send({ error: "criativo sem versão" });

		const base = current.spec as unknown as Spec;
		const next = reflow(mergeSpec(base, parsed.data.patch));
		const issues = validateSpec(next, creative.app.director as Record<string, unknown>);
		if (issues.errors.length) return reply.code(422).send({ error: "spec inválido", issues });

		const hash = specHash(next);
		// An identical spec means an identical render — appending a version would only add
		// noise to the history and invite a pointless re-render.
		if (hash === current.specHash) {
			return { unchanged: true, version: current.version, issues, changes: [] };
		}

		const version = await prisma.creativeVersion.create({
			data: {
				creativeId: creative.id,
				version: current.version + 1,
				spec: next as object,
				specHash: hash,
				createdBy: parsed.data.createdBy,
				note: parsed.data.note,
			},
		});

		return {
			version,
			issues,
			durationMs: specDurationMs(next),
			changes: diff(base, next),
		};
	});

	/**
	 * Creates a child creative that differs along ONE named dimension.
	 * The mutation name is what later lets a metric be attributed to a cause.
	 */
	app.post<{ Params: { id: string } }>("/creatives/:id/variations", async (request, reply) => {
		const parsed = variationSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const parent = await prisma.creative.findUnique({
			where: { id: request.params.id },
			include: { app: { select: { director: true } } },
		});
		if (!parent) return reply.code(404).send({ error: "criativo pai não encontrado" });

		const current = await latestVersion(parent.id);
		if (!current) return reply.code(409).send({ error: "criativo sem versão" });

		const base = current.spec as unknown as Spec;
		const next = reflow(mergeSpec(base, parsed.data.patch));
		const issues = validateSpec(next, parent.app.director as Record<string, unknown>);
		if (issues.errors.length) return reply.code(422).send({ error: "spec inválido", issues });

		const child = await prisma.creative.create({
			data: {
				appId: parent.appId,
				userId: request.user.sub,
				templateId: parent.templateId,
				name: parsed.data.name ?? `${parent.name} · ${parsed.data.mutation}`,
				locale: parent.locale,
				parentId: parent.id,
				mutation: parsed.data.mutation,
				localeGroupId: parent.localeGroupId,
				versions: {
					create: { version: 1, spec: next as object, specHash: specHash(next), createdBy: "ai" },
				},
			},
			include: { versions: true },
		});

		return reply.code(201).send({ creative: child, issues, changes: diff(base, next) });
	});

	/** The lineage tree for one creative's root — what the UI draws to show which mutation won. */
	app.get<{ Params: { id: string } }>("/creatives/:id/lineage", async (request, reply) => {
		const creative = await prisma.creative.findUnique({ where: { id: request.params.id } });
		if (!creative) return reply.code(404).send({ error: "criativo não encontrado" });

		// Walk up to the root, then collect everything below it.
		let rootId = creative.id;
		let cursor = creative;
		while (cursor.parentId) {
			const parent = await prisma.creative.findUnique({ where: { id: cursor.parentId } });
			if (!parent) break;
			cursor = parent;
			rootId = parent.id;
		}

		const all = await prisma.creative.findMany({
			where: { appId: creative.appId },
			select: { id: true, name: true, parentId: true, mutation: true, status: true, createdAt: true },
		});

		const byParent = new Map<string | null, typeof all>();
		for (const c of all) {
			const list = byParent.get(c.parentId) ?? [];
			list.push(c);
			byParent.set(c.parentId, list);
		}

		const build = (id: string): unknown => {
			const node = all.find((c) => c.id === id);

			return { ...node, children: (byParent.get(id) ?? []).map((c) => build(c.id)) };
		};

		return build(rootId);
	});
}
