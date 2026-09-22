import { config } from "dotenv";
import { z } from "zod";

// Loads .env for local runs. In Docker the variables come from compose and this is a
// no-op — but without it, `npm run dev` fails with "Required" on everything, which reads
// like a config mistake rather than a missing loader.
config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.coerce.number().int().positive().default(11200),
	DATABASE_URL: z.string().min(1),
	REDIS_URL: z.string().default("redis://localhost:6390"),
	// Long enough that a weak secret cannot be set by accident.
	JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
	JWT_EXPIRATION: z.string().default("30d"),
	RENDER_SERVICE_URL: z.string().url().default("http://localhost:11100"),
	STORAGE_DIR: z.string().default("./storage"),
	ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
	// URL pública da API (ex: https://creativebuilder.lucasqueiroga.shop). Usada para servir
	// assets de b-roll baixados por uma URL que o render (Chrome) e o preview (navegador)
	// alcançam. Vazio = mantém a URL do provedor no spec (que expira ~7 dias).
	PUBLIC_API_BASE: z.string().default(""),
	HIGGSFIELD_WORKSPACE_ID: z.string().optional(),
	// Provider da IA que escreve/ajusta o spec e diagnostica métricas.
	//   "codex"     → Codex CLI (`codex exec`) logado por OAuth (assinatura ChatGPT). Sem
	//                 API key no servidor; o login vive em CODEX_HOME/auth.json.
	//   "anthropic" → SDK da Anthropic com ANTHROPIC_API_KEY (comportamento legado).
	AI_PROVIDER: z.enum(["codex", "anthropic"]).default("codex"),
	// Fase 2 — a IA escreve/edita o CreativeSpec. Sem a chave, os endpoints de geração
	// respondem 503 com instrução; o resto da API funciona normal.
	ANTHROPIC_API_KEY: z.string().optional(),
	ANTHROPIC_MODEL: z.string().default("claude-opus-4-8"),
	// Onde o Codex acha o login OAuth (auth.json) e o config.toml — igual ao CODEX_HOME do
	// CLI. Vazio = ~/.codex. No container, monte o dir do `codex login` do host aqui.
	CODEX_HOME: z.string().default(""),
	// Binário do Codex (default assume no PATH).
	CODEX_BIN: z.string().default("codex"),
	// Modelo do Codex. Vazio = usa o default do próprio Codex / config.toml.
	CODEX_MODEL: z.string().default(""),
	// Teto de tempo (ms) de uma chamada do Codex antes de abortar.
	CODEX_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	// Fase 3 — geração de b-roll no Higgsfield (api.higgsfield.ai). Credenciais server-side
	// criadas em cloud.higgsfield.ai. Sem elas, os endpoints de b-roll respondem 503.
	// O path do modelo de vídeo é configurável porque varia por modelo (Seedance/Kling/...);
	// confirmar no cloud e setar HIGGSFIELD_VIDEO_ENDPOINT (ex: /higgsfield-ai/<modelo>/<versao>).
	HIGGSFIELD_API_KEY_ID: z.string().optional(),
	HIGGSFIELD_API_KEY_SECRET: z.string().optional(),
	HIGGSFIELD_BASE_URL: z.string().url().default("https://api.higgsfield.ai"),
	HIGGSFIELD_VIDEO_ENDPOINT: z.string().default(""),
	// JSON extra mesclado no body do submit (ex: {"model":"...","duration":5}). Opcional.
	HIGGSFIELD_VIDEO_PARAMS: z.string().default("{}"),
	HIGGSFIELD_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
	HIGGSFIELD_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	// Fase 3 — geração de b-roll no kie.ai (unified jobs API, api.kie.ai). Só precisa da key
	// (criada em kie.ai) — o modelo (KIE_MODEL) tem default e vale pra todos. Sem a key, o
	// provedor "kie" fica indisponível na plataforma.
	KIE_API_KEY: z.string().optional(),
	KIE_BASE_URL: z.string().url().default("https://api.kie.ai"),
	// Modelo do unified jobs API (createTask). Default = Seedance 1.5 Pro, o b-roll barato —
	// mesmos ids do tool local `tools/kie.mjs` (ex: bytedance/seedance-1.5-pro, kling/v3-*).
	// Obs: os modelos Veo usam OUTRO endpoint (/api/v1/veo/*) e não passam por aqui.
	KIE_MODEL: z.string().default("bytedance/seedance-1.5-pro"),
	// JSON extra mesclado no `input` do createTask (ex: {"resolution":"1080p","duration":8}).
	KIE_VIDEO_PARAMS: z.string().default("{}"),
	KIE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
	KIE_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	// Provedor de b-roll default quando a plataforma não escolhe um. Se o escolhido não estiver
	// configurado, o servidor cai no primeiro provedor habilitado.
	BROLL_PROVIDER: z.enum(["higgsfield", "kie"]).default("kie"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("❌ Variáveis de ambiente inválidas:");
	console.error(JSON.stringify(parsed.error.format(), null, 2));
	process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
