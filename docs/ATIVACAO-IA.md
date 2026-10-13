# IA no CreativeBuilder — onde ela roda

> **Fora de uso por enquanto.** O fluxo oficial do CreativeBuilder é **100% local**: Claude Code +
> Higgsfield CLI + Remotion, sem plataforma web e sem API key. Comece por
> [`COMECE-AQUI.md`](../COMECE-AQUI.md). Este documento fica só como referência para o futuro.

**Decisão: toda a IA roda no agente local (Claude Code), não no servidor.** Sem
`ANTHROPIC_API_KEY` e sem credencial do Higgsfield no VPS.

| O quê | Onde roda | Como |
|---|---|---|
| Escrever / ajustar o `CreativeSpec` | Claude Code | skill `criativo` (`.claude/skills/criativo/SKILL.md`) ou `AGENTS.md` |
| B-roll (`generative_video`) | Claude Code | **Higgsfield CLI ou MCP**, pela conta logada (OAuth) — ver `COMO-USAR.md` |
| Diagnóstico de performance | Claude Code | skill `criativo`, seção "Análise de performance", sobre o CSV exportado |
| Ingestão de referência | local **ou** plataforma | `tools/ingest-reference.mjs` / seção Referências no app |
| Editar, versionar, renderizar still/MP4 | plataforma **ou** local | editor web / `npx remotion` |
| Métricas por CSV (hook/hold/CTR/quartis) | plataforma | `POST /apps/:id/metrics` — sem chave nenhuma |

## Endpoints de IA do servidor — inertes de propósito

O código do servidor ainda tem os endpoints de IA server-side. Sem as chaves eles respondem
`503`, e **o `docker-compose.yml` não repassa essas variáveis ao container `api`** — mesmo
que alguém preencha o `.env`, elas não chegam. Isso é intencional neste setup.

| Endpoint | Precisaria de |
|---|---|
| `POST /creatives/generate` · `POST /creatives/:id/adjust` · `POST /apps/:id/metrics/diagnose` | `ANTHROPIC_API_KEY` |
| `POST /creatives/:id/broll` · `POST /broll/test` · `GET /broll/providers` | `KIE_API_KEY` (kie.ai) **ou** `HIGGSFIELD_API_KEY_ID/SECRET` + `HIGGSFIELD_VIDEO_ENDPOINT` |

Na UI, o painel **"Gerar criativo com IA"** (página do app), a caixa **"Ajustar com IA"** e o
botão **"gerar b-roll"** (página do criativo) chamam esses endpoints.

### B-roll na plataforma — provedor selecionável (kie.ai ou Higgsfield)

O código do b-roll roda **na plataforma** (server-side, REST). A página do criativo tem um
**seletor de provedor** ao lado do botão "gerar b-roll"; ele só mostra os provedores
habilitados (via `GET /broll/providers`). O default é o `BROLL_PROVIDER`.

> As variáveis precisam **chegar ao container `api`**. Como neste projeto o `docker-compose.yml`
> versionado é genérico (o de produção é local, não-versionado), no deploy da VPS as linhas
> `BROLL_PROVIDER` / `KIE_*` / `HIGGSFIELD_*` já estão no `environment:` do `api`. Num clone
> novo, adicione-as ao `environment:` do serviço `api` (ver bloco de exemplo abaixo).

- **kie.ai** (recomendado, mais simples): sete `KIE_API_KEY` no `.env`. Modelo em `KIE_MODEL`
  (default `bytedance/seedance-1.5-pro`, o b-roll barato — mesmos ids do `tools/kie.mjs`); campos
  extra do `input` em `KIE_VIDEO_PARAMS` (ex: `{"resolution":"720p","duration":5}`).
  Usa o unified jobs API (`POST /api/v1/jobs/createTask` → poll `GET /api/v1/jobs/recordInfo`).
  Os modelos **Veo** usam outro endpoint na kie e não passam por essa rota — pra Veo, use o `tools/kie.mjs` local.
- **Higgsfield**: sete `HIGGSFIELD_API_KEY_ID/SECRET` + `HIGGSFIELD_VIDEO_ENDPOINT`.

Dá pra habilitar os dois ao mesmo tempo — o seletor mostra ambos e a escolha vai por request.
Depois de editar o `.env`: `docker compose up -d --build api web`.

Se um dia a decisão mudar, é preciso: (1) adicionar as variáveis no `environment:` do
serviço `api` no `docker-compose.yml`; (2) preencher no `.env`; (3) `docker compose up -d
--build api`. As variáveis aceitas estão em `server/src/lib/env.ts`. Para o b-roll gerado
pelo servidor não expirar, inclua também `PUBLIC_API_BASE` (URL pública da API): o
`/creatives/:id/broll` baixa o clipe para `/media/assets` e o serve em `GET /assets/:file`.
Sem ela, o spec fica com a URL do provedor (~7 dias).

## B-roll gerado local × render na plataforma

O b-roll gerado no Claude Code vai para `render/public/broll/` e o spec referencia esse
caminho. O container de render da plataforma **não enxerga essa pasta** e a API não tem
upload de asset. Então:

- **MP4 final com b-roll → renderize local** (`npx remotion render`).
- Na plataforma, um spec com b-roll só renderiza se o `src` for a URL do Higgsfield — serve
  para rascunho, mas **expira em ~7 dias**.
- Subir asset para o volume `/media` e servir de lá é o follow-up que resolve isso.

## Fluxo completo ("criativo infinito")

referência (local ou plataforma) → Claude Code escreve o spec → Higgsfield (CLI/MCP) gera o
b-roll → Remotion renderiza o MP4 → variações (`spec-tool variant`) → CSV de métricas →
Claude Code diagnostica e propõe a próxima variação.

## Pipeline "Concorrentes" — TrendTrack → criativo → rascunho na Meta

Tela `/apps/<id>/concorrentes` (link na página do app). Três etapas, estado na tabela
`competitor_ads`, avançadas por um laço dentro do processo da API (`server/src/lib/pipeline.ts`,
seguro a restart porque cada estágio é "a fazer"):

| Etapa | O que faz | Precisa de |
|---|---|---|
| 01 varrer | anúncios **ativos** dos concorrentes (páginas do Facebook) e/ou por termo, ativos há ≥ N dias, por alcance | `TRENDTRACK_API_KEY` (pago, cobre Brasil) e/ou `META_AD_LIBRARY_TOKEN` (API oficial da Biblioteca, grátis, só anúncio veiculado na UE/UK) |
| 01 manual | o time cola o link do anúncio (Biblioteca/Instagram/TikTok) ou sobe o vídeo → entra direto na 02 | nada (yt-dlp do servidor) |
| 02 gerar | vídeo do vencedor → referência (worker ingere) → IA escreve o spec do app (só estrutura/ritmo) → b-roll → render | IA (Codex/Anthropic) + `KIE_API_KEY` ou Higgsfield |
| 03 rascunho | sobe o MP4 e cria anúncio **PAUSED** no conjunto configurado; nunca ativa, nunca cria campanha/conjunto, nunca mexe em orçamento | `META_ACCESS_TOKEN` (System User, `ads_management`) + `META_AD_ACCOUNT_ID` |

Por padrão nada gasta sozinho: vencedor para em "vencedor" até alguém clicar **recriar**, e o
render pronto para em "pronto p/ revisão" até alguém clicar **enviar pra Meta**. Os checkboxes
"recriar sozinho" / "enviar sozinho" na configuração do app ligam o modo automático.

O TrendTrack cobra **por linha devolvida** — `perSource` (máx. por concorrente/termo) limita o
custo de cada varredura. `lookup` (busca de concorrente) e saldo são grátis.

Variáveis no `environment:` do serviço `api` (compose de produção):
`TRENDTRACK_API_KEY`, `META_AD_LIBRARY_TOKEN`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` e, opcionais, `META_PAGE_ID`,
`META_ADSET_ID`, `META_INSTAGRAM_USER_ID`, `META_API_VERSION`, `PIPELINE_ENABLED`,
`PIPELINE_TICK_MS`. A migration `1_competitor_pipeline` aplica no boot.
