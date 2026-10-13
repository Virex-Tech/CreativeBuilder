import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { env } from "@/lib/env";

/**
 * Provider de IA alternativo ao SDK da Anthropic: dispara o Codex CLI (`codex exec`)
 * autenticado por OAuth (assinatura ChatGPT), sem nenhuma API key no servidor.
 *
 * O login é criado uma vez com `codex login` (fluxo OAuth no navegador) e mora em
 * CODEX_HOME/auth.json. No container, monte esse diretório e aponte CODEX_HOME para ele —
 * o Codex renova o token sozinho, então o mount precisa ser de leitura/escrita.
 *
 * Cada chamada é stateless (`--ephemeral`) e roda em sandbox `read-only`: o modelo só pensa
 * e devolve o texto/JSON final; nunca executa comando nem escreve no disco do container.
 */

export class CodexError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CodexError";
	}
}

function codexHome(): string {
	return env.CODEX_HOME || join(homedir(), ".codex");
}

/** Há login (OAuth ou key) disponível para o Codex? */
export function codexEnabled(): boolean {
	return existsSync(join(codexHome(), "auth.json"));
}

interface CodexRun {
	/** Prompt completo (system + conteúdo) — enviado via stdin para não esbarrar no argv. */
	prompt: string;
	/** Imagens a anexar (`-i`), ex: frames de uma referência. */
	imagePaths?: string[];
	/** JSON Schema da resposta final (`--output-schema`). Omitido = texto livre. */
	schema?: unknown;
}

/** Roda `codex exec` e devolve a última mensagem do agente (texto puro). */
export async function codexRun({ prompt, imagePaths, schema }: CodexRun): Promise<string> {
	if (!codexEnabled()) {
		throw new CodexError(
			"Codex sem login: rode `codex login` e monte o CODEX_HOME (auth.json) no servidor",
		);
	}

	const dir = await mkdtemp(join(tmpdir(), "codex-"));
	const outFile = join(dir, "last.txt");
	const args = [
		"exec",
		"--ephemeral", // não persiste a sessão em disco
		"--skip-git-repo-check", // o container não é um repositório git
		"-s", "read-only", // só pensa e devolve o resultado; não roda comando nem escreve
		"--color", "never",
		"-o", outFile, // grava só a mensagem final aqui
		"-", // lê o prompt do stdin
	];
	if (env.CODEX_MODEL) args.push("-m", env.CODEX_MODEL);
	if (schema) {
		const schemaFile = join(dir, "schema.json");
		await writeFile(schemaFile, JSON.stringify(schema));
		args.push("--output-schema", schemaFile);
	}
	for (const p of imagePaths ?? []) args.push("-i", p);

	try {
		await spawnCodex(args, prompt);

		return (await readFile(outFile, "utf8")).trim();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/** Spawna o binário do Codex com o prompt no stdin e resolve quando ele termina limpo. */
function spawnCodex(args: string[], stdin: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(env.CODEX_BIN, args, {
			env: { ...process.env, CODEX_HOME: codexHome() },
			stdio: ["pipe", "ignore", "pipe"],
		});

		let stderr = "";
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
			if (stderr.length > 8192) stderr = stderr.slice(-8192); // só a cauda do erro
		});

		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new CodexError(`Codex excedeu ${env.CODEX_TIMEOUT_MS}ms`));
		}, env.CODEX_TIMEOUT_MS);

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(new CodexError(`falha ao executar '${env.CODEX_BIN}': ${err.message}`));
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new CodexError(`Codex saiu com código ${code}: ${stderr.trim() || "(sem stderr)"}`));
		});

		child.stdin.write(stdin);
		child.stdin.end();
	});
}

/**
 * Login por "device authorization": `codex login --device-auth` imprime um link e um código
 * de uso único; o admin abre o link no navegador (qualquer aparelho), entra com a conta
 * ChatGPT e digita o código. O processo fica rodando esperando a autorização e, ao concluir,
 * grava o auth.json em CODEX_HOME — o mesmo dir montado no container. Nenhum CLI/arquivo do
 * lado do usuário. Isso alimenta o botão "Conectar Codex" da plataforma.
 */

interface DeviceLogin {
	child: ChildProcess;
	url: string;
	code: string;
	startedAt: number;
	status: "pending" | "done" | "error";
	error?: string;
}

/** O código expira em ~15min no provedor; damos uma folga menor para reiniciar antes disso. */
const DEVICE_TTL_MS = 14 * 60 * 1000;
const ANSI = /\x1b\[[0-9;]*m/g;

let deviceLogin: DeviceLogin | null = null;

export type LoginStatus = "connected" | "pending" | "disconnected";

/** Estado atual do login do Codex. */
export function codexLoginStatus(): LoginStatus {
	if (codexEnabled()) return "connected";
	if (deviceLogin?.status === "pending" && Date.now() - deviceLogin.startedAt < DEVICE_TTL_MS) {
		return "pending";
	}

	return "disconnected";
}

/** Link + código do login em andamento (se houver), para a UI exibir. */
export function currentDeviceCode(): { url: string; code: string } | null {
	if (deviceLogin?.status === "pending" && Date.now() - deviceLogin.startedAt < DEVICE_TTL_MS) {
		return { url: deviceLogin.url, code: deviceLogin.code };
	}

	return null;
}

/** Inicia (ou reaproveita) um device-login e devolve o link + código para o usuário autorizar. */
export function startDeviceLogin(): Promise<{ url: string; code: string }> {
	if (codexEnabled()) return Promise.reject(new CodexError("Codex já está conectado"));

	const existing = currentDeviceCode();
	if (existing) return Promise.resolve(existing);

	// Descarta um login velho/travado antes de abrir outro.
	if (deviceLogin && !deviceLogin.child.killed) deviceLogin.child.kill("SIGKILL");

	return new Promise((resolve, reject) => {
		const child = spawn(env.CODEX_BIN, ["login", "--device-auth"], {
			env: { ...process.env, CODEX_HOME: codexHome() },
			stdio: ["ignore", "pipe", "pipe"],
		});
		const state: DeviceLogin = { child, url: "", code: "", startedAt: Date.now(), status: "pending" };
		deviceLogin = state;

		let buf = "";
		let settled = false;
		const scan = (d: Buffer) => {
			buf += d.toString().replace(ANSI, "");
			const url = buf.match(/https:\/\/\S*openai\.com\/\S*/i)?.[0]?.replace(/[).,]+$/, "");
			const code = buf.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b/)?.[0];
			if (!settled && url && code) {
				settled = true;
				clearTimeout(timer);
				state.url = url;
				state.code = code;
				resolve({ url, code });
			}
		};
		child.stdout.on("data", scan);
		child.stderr.on("data", scan);

		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				child.kill("SIGKILL");
				state.status = "error";
				state.error = "timeout ao obter o código";
				reject(new CodexError("timeout ao iniciar o login do Codex"));
			}
		}, 30000);

		child.on("error", (err) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				state.status = "error";
				reject(new CodexError(`falha ao iniciar login: ${err.message}`));
			}
		});
		child.on("close", (exit) => {
			state.status = exit === 0 ? "done" : "error";
			if (exit !== 0 && !state.error) state.error = `login encerrou com código ${exit}`;
		});
	});
}

/** Teste rápido de que o login vale: uma chamada mínima ao modelo. */
export async function codexTest(): Promise<string> {
	return codexRun({ prompt: "Responda apenas com a palavra: OK" });
}
