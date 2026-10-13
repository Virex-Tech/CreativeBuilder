import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const createUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "senha precisa de ao menos 8 caracteres"),
	name: z.string().min(1),
	role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

/**
 * Auth for an internal team tool: no self-signup, no billing, no password reset flow.
 * An admin creates accounts. The one exception is bootstrap — the FIRST user may be created
 * without a token, otherwise a fresh install has no way in.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
	app.post("/auth/login", async (request, reply) => {
		const parsed = loginSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
		// Same response for unknown email and wrong password, so the endpoint cannot be used
		// to enumerate who has an account.
		const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
		if (!user || !ok) return reply.code(401).send({ error: "credenciais inválidas" });

		const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

		return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
	});

	app.post("/auth/users", async (request, reply) => {
		const parsed = createUserSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });

		const userCount = await prisma.user.count();
		if (userCount > 0) {
			// After bootstrap, only an admin may create accounts.
			try {
				await request.jwtVerify();
			} catch {
				return reply.code(401).send({ error: "token obrigatório" });
			}
			if (request.user.role !== "ADMIN") {
				return reply.code(403).send({ error: "somente admin cria usuários" });
			}
		}

		const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
		if (exists) return reply.code(409).send({ error: "email já cadastrado" });

		const user = await prisma.user.create({
			data: {
				email: parsed.data.email,
				name: parsed.data.name,
				passwordHash: await bcrypt.hash(parsed.data.password, 10),
				// The first account is always an admin — otherwise nobody could create the second.
				role: userCount === 0 ? "ADMIN" : parsed.data.role,
			},
		});

		return reply
			.code(201)
			.send({ id: user.id, email: user.email, name: user.name, role: user.role });
	});

	app.get("/auth/me", { onRequest: [app.authenticate] }, async (request) => {
		const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
		if (!user) return { error: "usuário não encontrado" };

		return { id: user.id, email: user.email, name: user.name, role: user.role };
	});
}
