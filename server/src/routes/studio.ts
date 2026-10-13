import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

import type { Post, ReferenceAsset, SocialAccount, Take } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { agentEnabled } from "@/lib/specAuthor";
import { enabledProviders } from "@/lib/broll";
import { listDriveVideos } from "@/lib/drive";
import { env } from "@/lib/env";
import {
	authorizeUrl,
	connectAccount,
	exchangeCode,
	isConnected,
	oauthEnabled,
} from "@/lib/instagram";
import { KIE_CREDIT_USD, kieCredits, kieEnabled, startVeo, VEO_CREDITS } from "@/lib/kie";
import { prisma } from "@/lib/prisma";
import { signState, verifyState } from "@/lib/secrets";
import { EDITABLE, resumeStatus, type PostStatus } from "@/lib/studio";
import { driveDownloadUrl, fileSize, publicAssetUrl, takesDir, type Transcript } from "@/lib/takes";

/**
 * Estúdio de conteúdo: contas, calendário, postagens, takes e publicação. O trabalho pesado
 * (processar take, editar, renderizar, publicar) roda no worker e no laço de lib/studio.ts;
 * estas rotas só montam a postagem e mudam o status.
 */

/** Teto de upload de take: vídeo de celular em 4K passa fácil de 500 MB. */
const TAKE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const accountSchema = z.object({
	appId: z.string().uuid(),
	platform: z.enum(["INSTAGRAM", "TIKTOK"]).default("INSTAGRAM"),
	handle: z.string().min(1).transform((h) => h.replace(/^@/, "").trim()),
	displayName: z.string().nullish(),
	persona: z.string().nullish(),
	style: z.string().nullish(),
	slotTimes: z.array(z.string().regex(TIME)).max(24).default([]),
	driveFolder: z.string().nullish(),
	autoPublish: z.boolean().default(true),
	active: z.boolean().default(true),
});

const postSchema = z.object({
	accountId: z.string().uuid(),
	scheduledAt: z.coerce.date(),
	title: z.string().nullish(),
	instructions: z.string().nullish(),
	caption: z.string().nullish(),
});

const postPatchSchema = z.object({
	scheduledAt: z.coerce.date().optional(),
	title: z.string().nullish(),
	instructions: z.string().nullish(),
	caption: z.string().nullish(),
	accountId: z.string().uuid().optional(),
});

/** Conta sem o token (nunca sai do servidor). */
function safeAccount(a: SocialAccount) {
	const { accessTokenEnc: _secret, ...rest } = a;

	return { ...rest, connected: isConnected(a) };
}

const posterOf = (videoFile: string | null): string | null => (videoFile ? videoFile.replace(/\.mp4$/, ".jpg") : null);

function refFrameUrl(ref: ReferenceAsset | null, index = 0): string | null {
	const frames = (ref?.manifest as { frames?: { file: string }[] } | undefined)?.frames;
	const file = frames?.[index]?.file?.split("/").pop();
	if (!ref || !file) return null;
	const base = env.PUBLIC_API_BASE.replace(/\/$/, "");

	return `${base}/ref-frames/${ref.id}/${file}`;
}

function takeOut(t: Take) {
	const transcript = t.transcript as Transcript | null;

	return {
		id: t.id,
		source: t.source,
		sourceUrl: t.sourceUrl,
		originalName: t.originalName,
		status: t.status,
		error: t.error,
		durationMs: t.durationMs,
		width: t.width,
		height: t.height,
		prompt: t.prompt,
		sortOrder: t.sortOrder,
		text: transcript?.text ?? null,
		videoUrl: publicAssetUrl(t.file),
		thumbUrl: publicAssetUrl(t.thumbFile),
		createdAt: t.createdAt,
	};
}

function uploadLink(post: Post): string | null {
	return env.PUBLIC_WEB_URL ? `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/enviar/${post.uploadToken}` : null;
}

/** Recebe UM arquivo multipart em takes/ e cria o take. Usado pelo time e pelo link de envio. */
async function receiveTake(request: FastifyRequest, reply: FastifyReply, post: Post, source: "UPLOAD" | "SENDER") {
	if (!request.isMultipart()) return reply.code(400).send({ error: "envie o vídeo como arquivo (multipart)" });
	const file = await request.file({ limits: { fileSize: TAKE_MAX_BYTES, files: 1 } });
	if (!file) return reply.code(400).send({ error: "nenhum arquivo enviado" });

	const take = await prisma.take.create({
		data: {
			appId: post.appId,
			accountId: post.accountId,
			postId: post.id,
			source,
			originalName: file.filename.slice(0, 200),
			status: "RECEIVING",
			sortOrder: await prisma.take.count({ where: { postId: post.id } }),
		},
	});
	await mkdir(takesDir(), { recursive: true });
	const rawPath = join(takesDir(), `${take.id}${extname(file.filename).slice(0, 8) || ".mp4"}`);
	try {
		await pipeline(file.file, createWriteStream(rawPath));
	} catch (err) {
		// Upload caiu no meio (celular perdeu sinal): não deixa um take fantasma "recebendo".
		await rm(rawPath, { force: true });
		await prisma.take.delete({ where: { id: take.id } });
		throw err;
	}

	if (file.file.truncated || (await fileSize(rawPath)) === 0) {
		await rm(rawPath, { force: true });
		await prisma.take.delete({ where: { id: take.id } });

		return reply.code(413).send({ error: file.file.truncated ? "arquivo passa de 2 GB" : "arquivo vazio" });
	}
	const ready = await prisma.take.update({ where: { id: take.id }, data: { rawPath, status: "QUEUED" } });

	return reply.code(201).send(takeOut(ready));
}

async function postDetail(id: string) {
	const post = await prisma.post.findUnique({
		where: { id },
		include: {
			account: true,
			reference: true,
			takes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
			creative: { include: { versions: { orderBy: { version: "desc" }, select: { version: true, note: true, createdAt: true, createdBy: true } } } },
		},
	});
	if (!post) return null;
	const render = post.renderJobId ? await prisma.renderJob.findUnique({ where: { id: post.renderJobId } }) : null;
	const manifest = (post.reference?.manifest ?? {}) as { frames?: { file: string }[]; transcript?: { text?: string }; durationSec?: number; avgShotSec?: number };

	return {
		...post,
		account: safeAccount(post.account),
		takes: post.takes.map(takeOut),
		reference: post.reference
			? {
					id: post.reference.id,
					status: post.reference.status,
					error: post.reference.error,
					sourceUrl: post.reference.sourceUrl,
					durationSec: manifest.durationSec ?? null,
					avgShotSec: manifest.avgShotSec ?? null,
					transcript: manifest.transcript?.text ?? null,
					frames: (manifest.frames ?? []).slice(0, 12).map((_, i) => refFrameUrl(post.reference, i)),
				}
			: null,
		versions: post.creative?.versions ?? [],
		creative: undefined,
		render: render ? { id: render.id, status: render.status, progress: render.progress, error: render.error } : null,
		videoUrl: publicAssetUrl(post.videoFile),
		posterUrl: publicAssetUrl(posterOf(post.videoFile)),
		uploadUrl: uploadLink(post),
	};
}

export async function studioRoutes(app: FastifyInstance): Promise<void> {
	// ------------------------------------------------------------------ públicas (sem login)

	/** Volta do login do Instagram. O `state` assinado diz qual conta está conectando. */
	app.get<{ Querystring: { code?: string; state?: string; error_description?: string } }>(
		"/studio/instagram/callback",
		async (request, reply) => {
			const web = env.PUBLIC_WEB_URL.replace(/\/$/, "");
			const accountId = verifyState(request.query.state);
			const back = (q: string): FastifyReply => reply.redirect(`${web}/estudio/contas?${q}`);
			if (!accountId) return back("ig=erro&msg=" + encodeURIComponent("link de conexão expirado — tente de novo"));
			if (!request.query.code) return back("ig=erro&msg=" + encodeURIComponent(request.query.error_description ?? "autorização cancelada"));
			try {
				await connectAccount(accountId, await exchangeCode(request.query.code.replace(/#_$/, "")));

				return back("ig=ok");
			} catch (err) {
				return back("ig=erro&msg=" + encodeURIComponent(err instanceof Error ? err.message : "falha ao conectar"));
			}
		},
	);

	/** Link de envio: o criador vê pra qual postagem está mandando e sobe os takes. */
	app.get<{ Params: { token: string } }>("/public/send/:token", async (request, reply) => {
		const post = await prisma.post.findUnique({
			where: { uploadToken: request.params.token },
			include: { account: true, takes: { where: { source: "SENDER" }, orderBy: { createdAt: "asc" } } },
		});
		if (!post) return reply.code(404).send({ error: "link inválido" });

		return {
			handle: post.account.handle,
			title: post.title,
			scheduledAt: post.scheduledAt,
			// A instrução de edição é interna (pro editor/IA) — não vai pro criador.
			takes: post.takes.map((t) => ({ id: t.id, name: t.originalName, status: t.status, createdAt: t.createdAt })),
		};
	});

	app.post<{ Params: { token: string } }>("/public/send/:token", async (request, reply) => {
		const post = await prisma.post.findUnique({ where: { uploadToken: request.params.token } });
		if (!post) return reply.code(404).send({ error: "link inválido" });
		if (post.status === "PUBLISHED") return reply.code(409).send({ error: "essa postagem já foi publicada" });

		return receiveTake(request, reply, post, "SENDER");
	});

	// ------------------------------------------------------------------ com login
	void app.register(async (auth) => {
		auth.addHook("onRequest", app.authenticate);

		auth.get("/studio/status", async () => ({
			ai: agentEnabled(),
			kie: kieEnabled(),
			broll: enabledProviders(),
			instagramOauth: oauthEnabled(),
			drive: env.GOOGLE_API_KEY ? "api" : "public-page",
			uploadLinks: Boolean(env.PUBLIC_WEB_URL),
			takeModel: env.KIE_TAKE_MODEL,
			takeCostUsd: Number(((VEO_CREDITS[env.KIE_TAKE_MODEL] ?? 60) * KIE_CREDIT_USD).toFixed(2)),
		}));

		// ---------------------------------------------------------------- contas
		auth.get("/studio/accounts", async () => {
			const rows = await prisma.socialAccount.findMany({
				orderBy: [{ active: "desc" }, { createdAt: "asc" }],
				include: { app: { select: { id: true, name: true } } },
			});

			return rows.map((a) => ({ ...safeAccount(a), app: a.app }));
		});

		auth.post("/studio/accounts", async (request, reply) => {
			const parsed = accountSchema.safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
			const created = await prisma.socialAccount.create({
				data: { ...parsed.data, slotTimes: [...new Set(parsed.data.slotTimes)].sort() },
			});

			return reply.code(201).send(safeAccount(created));
		});

		auth.patch<{ Params: { id: string } }>("/studio/accounts/:id", async (request, reply) => {
			const parsed = accountSchema.partial().safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
			const data = { ...parsed.data };
			if (data.slotTimes) data.slotTimes = [...new Set(data.slotTimes)].sort();
			const updated = await prisma.socialAccount.update({ where: { id: request.params.id }, data });

			return safeAccount(updated);
		});

		auth.delete<{ Params: { id: string } }>("/studio/accounts/:id", async (request, reply) => {
			await prisma.socialAccount.delete({ where: { id: request.params.id } });

			return reply.code(204).send();
		});

		/** Conectar pelo login do Instagram (precisa do app da Meta configurado no servidor). */
		auth.post<{ Params: { id: string } }>("/studio/accounts/:id/instagram/connect", async (request, reply) => {
			if (!oauthEnabled()) {
				return reply.code(503).send({ error: "login do Instagram não configurado (INSTAGRAM_APP_ID/SECRET) — cole um token" });
			}

			return { url: authorizeUrl(signState(request.params.id)) };
		});

		/** Conectar colando um token (painel da Meta → Instagram → Gerar token). */
		auth.post<{ Params: { id: string } }>("/studio/accounts/:id/instagram/token", async (request, reply) => {
			const parsed = z.object({ accessToken: z.string().min(20) }).safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "cole o token de acesso" });
			try {
				return safeAccount(await connectAccount(request.params.id, parsed.data.accessToken));
			} catch (err) {
				return reply.code(400).send({ error: err instanceof Error ? err.message : "token recusado" });
			}
		});

		auth.post<{ Params: { id: string } }>("/studio/accounts/:id/instagram/disconnect", async (request) => {
			const updated = await prisma.socialAccount.update({
				where: { id: request.params.id },
				data: { accessTokenEnc: null, igUserId: null, tokenExpiresAt: null, connectedAt: null },
			});

			return safeAccount(updated);
		});

		// ---------------------------------------------------------------- calendário
		auth.get<{ Querystring: { from?: string; days?: string } }>("/studio/calendar", async (request) => {
			const from = request.query.from ? new Date(`${request.query.from}T00:00:00-03:00`) : new Date();
			const days = Math.min(31, Math.max(1, Number(request.query.days ?? 7)));
			const to = new Date(from.getTime() + days * 24 * 3600 * 1000);

			const [accounts, posts] = await Promise.all([
				prisma.socialAccount.findMany({
					where: { active: true },
					orderBy: { createdAt: "asc" },
					include: { app: { select: { id: true, name: true } } },
				}),
				prisma.post.findMany({
					where: { scheduledAt: { gte: from, lt: to } },
					orderBy: { scheduledAt: "asc" },
					include: {
						reference: true,
						takes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { thumbFile: true, status: true } },
					},
				}),
			]);

			return {
				accounts: accounts.map((a) => ({ ...safeAccount(a), app: a.app })),
				posts: posts.map((p) => ({
					id: p.id,
					accountId: p.accountId,
					scheduledAt: p.scheduledAt,
					status: p.status,
					title: p.title,
					error: p.error,
					permalink: p.permalink,
					hasReference: Boolean(p.referenceId),
					takes: p.takes.length,
					takesPending: p.takes.filter((t) => t.status !== "DONE" && t.status !== "FAILED").length,
					thumbUrl:
						publicAssetUrl(posterOf(p.videoFile)) ??
						publicAssetUrl(p.takes.find((t) => t.thumbFile)?.thumbFile) ??
						refFrameUrl(p.reference),
				})),
			};
		});

		// ---------------------------------------------------------------- postagens
		auth.post("/studio/posts", async (request, reply) => {
			const parsed = postSchema.safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
			const account = await prisma.socialAccount.findUnique({ where: { id: parsed.data.accountId } });
			if (!account) return reply.code(404).send({ error: "conta não encontrada" });
			const post = await prisma.post.create({
				data: { ...parsed.data, appId: account.appId, userId: request.user.sub },
			});

			return reply.code(201).send(post);
		});

		auth.get<{ Params: { id: string } }>("/studio/posts/:id", async (request, reply) => {
			const detail = await postDetail(request.params.id);

			return detail ?? reply.code(404).send({ error: "postagem não encontrada" });
		});

		auth.patch<{ Params: { id: string } }>("/studio/posts/:id", async (request, reply) => {
			const parsed = postPatchSchema.safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });
			if (post.status === "PUBLISHED" || post.status === "PUBLISHING") {
				return reply.code(409).send({ error: "postagem já está indo pro ar" });
			}
			const data: Record<string, unknown> = { ...parsed.data };
			if (parsed.data.accountId && parsed.data.accountId !== post.accountId) {
				const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: parsed.data.accountId } });
				data.appId = account.appId;
			}
			await prisma.post.update({ where: { id: post.id }, data });

			return postDetail(post.id);
		});

		auth.delete<{ Params: { id: string } }>("/studio/posts/:id", async (request, reply) => {
			await prisma.post.delete({ where: { id: request.params.id } });

			return reply.code(204).send();
		});

		/** Referência: link, upload, ou uma já ingerida (`referenceId`). */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/reference", async (request, reply) => {
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });

			let referenceId: string;
			if (request.isMultipart()) {
				const file = await request.file({ limits: { fileSize: 500 * 1024 * 1024, files: 1 } });
				if (!file) return reply.code(400).send({ error: "nenhum arquivo enviado" });
				const dir = join(env.STORAGE_DIR, "references", "uploads");
				await mkdir(dir, { recursive: true });
				const filePath = join(dir, `${crypto.randomUUID()}${extname(file.filename) || ".mp4"}`);
				await pipeline(file.file, createWriteStream(filePath));
				if (file.file.truncated) return reply.code(413).send({ error: "arquivo passa de 500 MB" });
				referenceId = (
					await prisma.referenceAsset.create({ data: { appId: post.appId, userId: request.user.sub, filePath, status: "QUEUED" } })
				).id;
			} else {
				const parsed = z
					.object({ sourceUrl: z.string().url().optional(), referenceId: z.string().uuid().optional() })
					.safeParse(request.body);
				if (!parsed.success || (!parsed.data.sourceUrl && !parsed.data.referenceId)) {
					return reply.code(400).send({ error: "envie o link, o vídeo ou uma referência existente" });
				}
				referenceId =
					parsed.data.referenceId ??
					(
						await prisma.referenceAsset.create({
							data: { appId: post.appId, userId: request.user.sub, sourceUrl: parsed.data.sourceUrl, status: "QUEUED" },
						})
					).id;
			}
			await prisma.post.update({ where: { id: post.id }, data: { referenceId } });

			return postDetail(post.id);
		});

		auth.delete<{ Params: { id: string } }>("/studio/posts/:id/reference", async (request) => {
			await prisma.post.update({ where: { id: request.params.id }, data: { referenceId: null } });

			return postDetail(request.params.id);
		});

		/** Referências já ingeridas do app — pra reaproveitar sem baixar de novo. */
		auth.get<{ Params: { id: string } }>("/studio/posts/:id/reference-options", async (request, reply) => {
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });
			const refs = await prisma.referenceAsset.findMany({
				where: { appId: post.appId, status: "DONE" },
				orderBy: { createdAt: "desc" },
				take: 40,
			});

			return refs.map((r) => ({ id: r.id, sourceUrl: r.sourceUrl, createdAt: r.createdAt, thumbUrl: refFrameUrl(r) }));
		});

		// ---------------------------------------------------------------- takes
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/takes", async (request, reply) => {
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });

			return receiveTake(request, reply, post, "UPLOAD");
		});

		/** Um ou vários links (um por linha): Drive, Dropbox, Instagram, TikTok, arquivo direto. */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/takes/link", async (request, reply) => {
			const parsed = z.object({ urls: z.array(z.string().url()).min(1).max(30) }).safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "cole um ou mais links válidos" });
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });
			let order = await prisma.take.count({ where: { postId: post.id } });
			for (const url of parsed.data.urls) {
				await prisma.take.create({
					data: { appId: post.appId, accountId: post.accountId, postId: post.id, source: "LINK", sourceUrl: url, sortOrder: order++ },
				});
			}

			return postDetail(post.id);
		});

		/** Importa os vídeos de uma pasta do Drive (a da conta, se não vier outra). Não duplica. */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/takes/drive", async (request, reply) => {
			const post = await prisma.post.findUnique({ where: { id: request.params.id }, include: { account: true } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });
			const folder = (request.body as { folderUrl?: string } | null)?.folderUrl || post.account.driveFolder;
			if (!folder) return reply.code(400).send({ error: "cole o link da pasta (ou salve uma pasta na conta)" });

			let files;
			try {
				files = await listDriveVideos(folder);
			} catch (err) {
				return reply.code(400).send({ error: err instanceof Error ? err.message : "falha ao ler a pasta" });
			}
			const known = new Set(
				(await prisma.take.findMany({ where: { postId: post.id, source: "DRIVE" }, select: { sourceId: true } })).map((t) => t.sourceId),
			);
			let order = await prisma.take.count({ where: { postId: post.id } });
			let imported = 0;
			for (const f of files) {
				if (known.has(f.id)) continue;
				await prisma.take.create({
					data: {
						appId: post.appId,
						accountId: post.accountId,
						postId: post.id,
						source: "DRIVE",
						sourceId: f.id,
						sourceUrl: driveDownloadUrl(f.id),
						originalName: f.name,
						sortOrder: order++,
					},
				});
				imported++;
			}

			return { imported, skipped: files.length - imported, post: await postDetail(post.id) };
		});

		/**
		 * Take gerado na kie.ai (Veo: pessoa falando, com som). Gasta crédito: sem `confirm` só
		 * devolve o custo; com `confirm: true` dispara.
		 */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/takes/generate", async (request, reply) => {
			const parsed = z.object({ prompt: z.string().min(10), confirm: z.boolean().default(false) }).safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "descreva a cena (quem fala, onde, o que diz entre aspas)" });
			if (!kieEnabled()) return reply.code(503).send({ error: "kie.ai não configurada no servidor (KIE_API_KEY)" });
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });

			const credits = VEO_CREDITS[env.KIE_TAKE_MODEL] ?? 60;
			const balance = await kieCredits();
			const cost = {
				model: env.KIE_TAKE_MODEL,
				seconds: 8,
				credits,
				usd: Number((credits * KIE_CREDIT_USD).toFixed(2)),
				balanceCredits: balance,
				balanceUsd: balance === null ? null : Number((balance * KIE_CREDIT_USD).toFixed(2)),
				enough: balance === null ? null : balance >= credits,
			};
			if (!parsed.data.confirm) return { cost, confirmed: false };

			let taskId: string;
			try {
				taskId = await startVeo(parsed.data.prompt, env.KIE_TAKE_MODEL);
			} catch (err) {
				const msg = err instanceof Error ? err.message : "a kie.ai recusou";

				return reply.code(/insufficient|402/i.test(msg) ? 402 : 502).send({
					error: /insufficient|402/i.test(msg) ? "saldo da kie.ai insuficiente — recarregue em kie.ai" : msg,
				});
			}
			await prisma.take.create({
				data: {
					appId: post.appId,
					accountId: post.accountId,
					postId: post.id,
					source: "KIE",
					prompt: parsed.data.prompt,
					providerTask: taskId,
					originalName: `IA · ${parsed.data.prompt.slice(0, 60)}`,
					status: "GENERATING",
					sortOrder: await prisma.take.count({ where: { postId: post.id } }),
				},
			});

			return { cost, confirmed: true, post: await postDetail(post.id) };
		});

		auth.patch<{ Params: { id: string } }>("/studio/takes/:id", async (request, reply) => {
			const parsed = z.object({ sortOrder: z.number().int().min(0) }).safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "dados inválidos" });
			const take = await prisma.take.update({ where: { id: request.params.id }, data: parsed.data });

			return takeOut(take);
		});

		auth.post<{ Params: { id: string } }>("/studio/takes/:id/retry", async (request) => {
			const take = await prisma.take.update({
				where: { id: request.params.id },
				data: { status: "QUEUED", error: null },
			});

			return takeOut(take);
		});

		auth.delete<{ Params: { id: string } }>("/studio/takes/:id", async (request, reply) => {
			await prisma.take.delete({ where: { id: request.params.id } });

			return reply.code(204).send();
		});

		// ---------------------------------------------------------------- fluxo
		const transition = async (
			request: FastifyRequest<{ Params: { id: string } }>,
			reply: FastifyReply,
			allowed: PostStatus[],
			next: (post: Post) => Promise<Partial<Post> & { status: PostStatus }>,
		) => {
			const post = await prisma.post.findUnique({ where: { id: request.params.id } });
			if (!post) return reply.code(404).send({ error: "postagem não encontrada" });
			if (!allowed.includes(post.status as PostStatus)) {
				return reply.code(409).send({ error: `não dá nesse momento (status ${post.status})` });
			}
			let data: Partial<Post> & { status: PostStatus };
			try {
				data = await next(post);
			} catch (err) {
				return reply.code(409).send({ error: err instanceof Error ? err.message : "não deu" });
			}
			await prisma.post.update({ where: { id: post.id }, data: { ...data, error: null } as object });

			return postDetail(post.id);
		};

		/** Editar (ou refazer do zero): a IA monta a partir dos takes + referência + instrução. */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/edit", (request, reply) =>
			transition(request, reply, EDITABLE, async () => ({ status: "QUEUED", approvedAt: null, igContainerId: null })),
		);

		auth.post<{ Params: { id: string } }>("/studio/posts/:id/revise", async (request, reply) => {
			const parsed = z.object({ note: z.string().min(2).max(4000) }).safeParse(request.body);
			if (!parsed.success) return reply.code(400).send({ error: "diga o que mudar" });

			return transition(request, reply, ["REVIEW", "APPROVED", "SCHEDULED", "FAILED"], async (post) => {
				if (!post.creativeId) throw new Error("ainda não há edição pra alterar");
				const history = Array.isArray(post.revisions) ? (post.revisions as unknown[]) : [];

				return {
					status: "REVISING",
					revisionNote: parsed.data.note,
					approvedAt: null,
					igContainerId: null,
					revisions: [...history, { at: new Date().toISOString(), note: parsed.data.note }] as unknown as Post["revisions"],
				};
			});
		});

		/** Aprovar: publica sozinho no horário (conta conectada) ou fica pronto pra postar à mão. */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/approve", async (request, reply) => {
			const now = (request.body as { now?: boolean } | null)?.now === true;

			return transition(request, reply, ["REVIEW", "APPROVED", "FAILED"], async (post) => {
				if (!post.videoFile) throw new Error("não há vídeo renderizado pra aprovar");
				const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: post.accountId } });
				const auto = isConnected(account) && account.autoPublish;

				return {
					status: auto || (now && isConnected(account)) ? "SCHEDULED" : "APPROVED",
					approvedAt: new Date(),
					...(now ? { scheduledAt: new Date() } : {}),
				};
			});
		});

		auth.post<{ Params: { id: string } }>("/studio/posts/:id/unapprove", (request, reply) =>
			transition(request, reply, ["APPROVED", "SCHEDULED"], async () => ({ status: "REVIEW", approvedAt: null })),
		);

		/** Postou à mão (TikTok, conta sem API): registra no calendário. */
		auth.post<{ Params: { id: string } }>("/studio/posts/:id/mark-published", async (request, reply) => {
			const permalink = (request.body as { permalink?: string } | null)?.permalink || null;

			return transition(request, reply, ["REVIEW", "APPROVED", "SCHEDULED", "FAILED"], async () => ({
				status: "PUBLISHED",
				publishedAt: new Date(),
				permalink,
			}));
		});

		auth.post<{ Params: { id: string } }>("/studio/posts/:id/retry", (request, reply) =>
			transition(request, reply, ["FAILED"], async (post) => {
				const { status, patch } = await resumeStatus(post);

				return { ...patch, status };
			}),
		);
	});
}
