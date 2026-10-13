import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const createSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "slug: minúsculas, números e hífen"),
	niche: z.string().optional(),
	director: z.record(z.unknown()).default({}),
	brandKit: z.record(z.unknown()).default({}),
});

const updateSchema = createSchema.partial().omit({ slug: true });

export async function appRoutes(app: FastifyInstance): Promise<void> {
	app.addHook("onRequest", app.authenticate);

	app.get("/apps", async () => {
		return prisma.app.findMany({
			orderBy: { createdAt: "desc" },
			include: { _count: { select: { creatives: true, references: true } } },
		});
	});

	app.post("/apps", async (request, reply) => {
		const parsed = createSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const exists = await prisma.app.findUnique({ where: { slug: parsed.data.slug } });
		if (exists) return reply.code(409).send({ error: "slug já usado" });

		const created = await prisma.app.create({
			data: {
				ownerId: request.user.sub,
				name: parsed.data.name,
				slug: parsed.data.slug,
				niche: parsed.data.niche,
				director: parsed.data.director as Prisma.InputJsonObject,
				brandKit: parsed.data.brandKit as Prisma.InputJsonObject,
			},
		});

		return reply.code(201).send(created);
	});

	app.get<{ Params: { id: string } }>("/apps/:id", async (request, reply) => {
		const found = await prisma.app.findUnique({
			where: { id: request.params.id },
			include: { _count: { select: { creatives: true, templates: true, assets: true } } },
		});
		if (!found) return reply.code(404).send({ error: "app não encontrado" });

		return found;
	});

	/**
	 * The DirectorProfile lives here as JSON so the team edits pacing, caption style and the
	 * `never` list from the UI, without a migration for every rule they invent.
	 */
	app.patch<{ Params: { id: string } }>("/apps/:id", async (request, reply) => {
		const parsed = updateSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const found = await prisma.app.findUnique({ where: { id: request.params.id } });
		if (!found) return reply.code(404).send({ error: "app não encontrado" });

		return prisma.app.update({
			where: { id: found.id },
			data: parsed.data as Prisma.AppUpdateInput,
		});
	});
}
