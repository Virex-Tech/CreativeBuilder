#!/usr/bin/env node
/**
 * Builds of the engine. Plain node + esbuild (devDependency), works on Windows and Linux.
 *
 *   node scripts/build.mjs preview   → preview-dist/ (index.html + main.js) — the /preview/ page
 *   node scripts/build.mjs lib       → lib/engine.mjs (COMMITTED — tools/spec-tool.mjs imports it)
 *                                      + server/src/lib/engine/footage.ts (COMMITTED mirror of
 *                                      src/footage.ts for the CreativeBuilder server, whose Docker
 *                                      build only sees server/). Skipped when ../server is absent.
 *   node scripts/build.mjs check     → fails (exit 1) if lib/engine.mjs or the server mirror are
 *                                      stale versus src/. Run in CI / before committing.
 *
 * Why generated-and-committed: the CLI runs with plain `node` (no TS toolchain on the agent's
 * machine) and the server builds in its own Docker context, so neither can import render/src/*.ts
 * directly. The source of truth stays ONE file: src/footage.ts.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_OUT = join(ROOT, "lib", "engine.mjs");
const SERVER_DIR = resolve(ROOT, "..", "server");
const SERVER_MIRROR = join(SERVER_DIR, "src", "lib", "engine", "footage.ts");

const LIB_BANNER = `// GERADO por render/scripts/build.mjs (npm run build:lib) a partir de render/src/engine.ts — NÃO EDITE.
// Fonte: render/src/footage.ts, formats.ts, urlRewrite.ts. Mude lá e rode \`npm run build:lib\` em render/.`;

const MIRROR_HEADER = `// GERADO por render/scripts/build.mjs (npm run build:lib) — cópia fiel de render/src/footage.ts. NÃO EDITE.
// Mude render/src/footage.ts e rode \`npm run build:lib\` em render/ (\`npm run check:lib\` acusa cópia velha).
`;

/** Line endings normalised: a Windows checkout with autocrlf must not read as "stale". */
const norm = (s) => s.replace(/\r\n/g, "\n");

async function libSource() {
	const result = await build({
		entryPoints: [join(ROOT, "src", "engine.ts")],
		bundle: true,
		format: "esm",
		platform: "neutral",
		target: "es2020",
		write: false,
		legalComments: "none",
		banner: { js: LIB_BANNER },
		// The engine must stay dependency-free; a stray import of zod/react fails the build here.
		external: [],
		logLevel: "silent",
	});

	return norm(result.outputFiles[0].text);
}

async function mirrorSource() {
	return MIRROR_HEADER + norm(await readFile(join(ROOT, "src", "footage.ts"), "utf8"));
}

async function buildLib() {
	await mkdir(dirname(LIB_OUT), { recursive: true });
	await writeFile(LIB_OUT, await libSource());
	console.log(`ok  ${relative(process.cwd(), LIB_OUT)}`);
	if (existsSync(join(SERVER_DIR, "package.json"))) {
		await mkdir(dirname(SERVER_MIRROR), { recursive: true });
		await writeFile(SERVER_MIRROR, await mirrorSource());
		console.log(`ok  ${relative(process.cwd(), SERVER_MIRROR)}`);
	} else {
		console.log("--  ../server ausente (build do container): espelho do servidor não gerado");
	}
}

async function check() {
	const stale = [];
	const read = async (p) => (existsSync(p) ? norm(await readFile(p, "utf8")) : null);
	if ((await read(LIB_OUT)) !== (await libSource())) stale.push(relative(process.cwd(), LIB_OUT));
	if (existsSync(join(SERVER_DIR, "package.json")) && (await read(SERVER_MIRROR)) !== (await mirrorSource())) {
		stale.push(relative(process.cwd(), SERVER_MIRROR));
	}
	if (stale.length) {
		console.error(`desatualizado (rode \`npm run build:lib\` em render/): ${stale.join(", ")}`);
		process.exit(1);
	}
	console.log("ok  lib/engine.mjs e espelho do servidor em dia com src/");
}

async function buildPreview() {
	const outDir = join(ROOT, "preview-dist");
	await mkdir(outDir, { recursive: true });
	await build({
		entryPoints: [join(ROOT, "preview", "main.tsx")],
		outfile: join(outDir, "main.js"),
		bundle: true,
		format: "iife",
		platform: "browser",
		target: "es2020",
		jsx: "automatic",
		minify: true,
		sourcemap: false,
		legalComments: "none",
		define: { "process.env.NODE_ENV": '"production"' },
		logLevel: "warning",
	});
	await copyFile(join(ROOT, "preview", "index.html"), join(outDir, "index.html"));
	console.log(`ok  ${relative(process.cwd(), outDir)}/ (index.html, main.js)`);
}

const cmd = process.argv[2];
const commands = { lib: buildLib, check, preview: buildPreview };
if (!commands[cmd]) {
	console.error("uso: node scripts/build.mjs preview | lib | check");
	process.exit(1);
}
commands[cmd]().catch((err) => {
	console.error(err);
	process.exit(1);
});
