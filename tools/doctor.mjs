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

function check(name, ok, detail, fix, optional = false) {
	results.push({ name, ok, detail, fix, optional });
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

// Python + faster-whisper (legenda sincronizada com a fala e transcrição de referências)
{
	const py = run("python", ["--version"]);
	if (!py.ok) {
		check("Python 3", false, "não encontrado", "winget install Python.Python.3.13  (depois feche e abra o terminal)");
	} else {
		check("Python 3", true, py.out, "");
		const fw = run("python", ["-c", '"import faster_whisper; print(faster_whisper.__version__)"']);
		check(
			"faster-whisper (legenda sincronizada)",
			fw.ok,
			fw.ok ? `versão ${fw.out}` : "não instalado",
			"python -m pip install faster-whisper",
		);
	}
}

// Kie.ai — plataforma padrão de geração (vídeo e voz). A chave fica só neste computador.
{
	const key = process.env.KIE_API_KEY?.trim();
	if (!key) {
		check(
			"Kie.ai (chave)",
			false,
			"KIE_API_KEY não definida",
			'crie a chave em https://kie.ai/api-key e rode: setx KIE_API_KEY "cole-a-chave"  (depois feche e abra o terminal)',
		);
	} else {
		try {
			const res = await fetch("https://api.kie.ai/api/v1/chat/credit", {
				headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
				signal: AbortSignal.timeout(20_000),
			});
			const json = await res.json();
			if (Number(json.code) === 200) {
				const creditos = Number(json.data);
				check(
					"Kie.ai (chave e saldo)",
					creditos > 0,
					`${creditos} créditos ≈ US$ ${(creditos * 0.005).toFixed(2)}`,
					"saldo zerado — recarregue em https://kie.ai (menu Billing)",
				);
			} else {
				check("Kie.ai (chave e saldo)", false, `Kie respondeu ${json.code}: ${json.msg}`, "confira a chave em https://kie.ai/api-key e rode setx KIE_API_KEY de novo");
			}
		} catch (e) {
			check("Kie.ai (chave e saldo)", false, `sem conexão com a Kie: ${e.message}`, "confira a internet e tente de novo");
		}
	}
}

// Higgsfield CLI + login (alternativa guardada — opcional)
{
	const v = run("higgsfield", ["--version"]);
	if (!v.ok) {
		check("Higgsfield CLI (opcional)", false, "não encontrado", "só se for usar a alternativa: npm i -g @higgsfield/cli", true);
	} else {
		check("Higgsfield CLI (opcional)", true, v.out.split(" ").slice(0, 2).join(" "), "", true);
		const s = run("higgsfield", ["account", "status"]);
		if (!s.ok) {
			const workspaceIssue = /workspace/i.test(s.out);
			check(
				"Higgsfield logado (opcional)",
				false,
				s.out || "sem login",
				workspaceIssue
					? "higgsfield workspace list  →  higgsfield workspace set <ID do workspace com plano pago>"
					: "higgsfield auth login  (entre com a conta da equipe; use janela anônima se cair na conta errada)",
				true,
			);
		} else {
			const free = /free plan/i.test(s.out);
			check(
				"Higgsfield logado (opcional)",
				!free,
				s.out,
				free
					? "conta free — faça  higgsfield auth logout  e  higgsfield auth login  com a conta paga da equipe"
					: "",
				true,
			);
		}
	}
}

let missing = 0;
console.log("\nCreativeBuilder — checagem do ambiente\n");
for (const r of results) {
	const icone = r.ok ? "✔" : r.optional ? "⚠" : "✘";
	console.log(`${icone} ${r.name}: ${r.detail}`);
	if (!r.ok) {
		if (!r.optional) missing++;
		console.log(`    → ${r.optional ? "se precisar" : "resolver"}: ${r.fix}`);
	}
}
console.log(
	missing === 0
		? "\nTudo pronto. Abra o Claude Code na pasta do projeto e peça um criativo.\n"
		: `\n${missing} item(ns) para resolver. Depois de instalar, feche e abra o terminal/VS Code e rode de novo.\n`,
);
process.exit(missing === 0 ? 0 : 1);
