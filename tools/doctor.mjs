#!/usr/bin/env node
/**
 * Checagem do ambiente local do CreativeBuilder.
 *
 *   node tools/doctor.mjs
 *
 * Diz, em português, o que está pronto e o que falta — com o comando para resolver. Pensado
 * para quem está configurando a máquina pela primeira vez. Não instala nada sozinho.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function run(cmd, args) {
	// shell:true resolve os atalhos .cmd/.ps1 que o npm e o winget criam no Windows.
	const r = spawnSync([cmd, ...args].join(" "), { shell: true, encoding: "utf8", timeout: 60_000 });
	return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function check(name, ok, detail, fix) {
	results.push({ name, ok, detail, fix });
}

// Node
const major = Number(process.versions.node.split(".")[0]);
check(
	"Node.js 22+",
	major >= 22,
	`versão ${process.versions.node}`,
	"winget install OpenJS.NodeJS.LTS  (depois feche e abra o VS Code)",
);

// Git
{
	const r = run("git", ["--version"]);
	check("Git", r.ok, r.ok ? r.out : "não encontrado", "winget install Git.Git");
}

// ffmpeg / ffprobe
for (const bin of ["ffmpeg", "ffprobe"]) {
	const r = run(bin, ["-version"]);
	check(bin, r.ok, r.ok ? r.out.split("\n")[0] : "não encontrado", "winget install Gyan.FFmpeg");
}

// yt-dlp
{
	const r = run("yt-dlp", ["--version"]);
	check("yt-dlp (referência por link)", r.ok, r.ok ? `versão ${r.out}` : "não encontrado", "winget install yt-dlp.yt-dlp");
}

// Dependências do Remotion
check(
	"Remotion instalado (render/node_modules)",
	existsSync(join(root, "render", "node_modules", "remotion")),
	existsSync(join(root, "render", "node_modules")) ? "ok" : "pasta não existe",
	"cd render && npm ci",
);

// Higgsfield CLI + login
{
	const v = run("higgsfield", ["--version"]);
	if (!v.ok) {
		check("Higgsfield CLI", false, "não encontrado", "npm i -g @higgsfield/cli");
	} else {
		check("Higgsfield CLI", true, v.out.split(" ").slice(0, 2).join(" "), "");
		const s = run("higgsfield", ["account", "status"]);
		if (!s.ok) {
			const workspaceIssue = /workspace/i.test(s.out);
			check(
				"Higgsfield logado",
				false,
				s.out || "sem login",
				workspaceIssue
					? "higgsfield workspace list  →  higgsfield workspace set <ID do workspace com plano pago>"
					: "higgsfield auth login  (entre com a conta da equipe; use janela anônima se cair na conta errada)",
			);
		} else {
			const free = /free plan/i.test(s.out);
			check(
				"Higgsfield logado",
				!free,
				s.out,
				free
					? "conta free — faça  higgsfield auth logout  e  higgsfield auth login  com a conta paga da equipe"
					: "",
			);
		}
	}
}

let missing = 0;
console.log("\nCreativeBuilder — checagem do ambiente\n");
for (const r of results) {
	console.log(`${r.ok ? "✔" : "✘"} ${r.name}: ${r.detail}`);
	if (!r.ok) {
		missing++;
		console.log(`    → resolver: ${r.fix}`);
	}
}
console.log(
	missing === 0
		? "\nTudo pronto. Abra o Claude Code na pasta do projeto e peça um criativo.\n"
		: `\n${missing} item(ns) para resolver. Depois de instalar, feche e abra o terminal/VS Code e rode de novo.\n`,
);
process.exit(missing === 0 ? 0 : 1);
