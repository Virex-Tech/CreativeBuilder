# Como usar — referência técnica

> **Primeira vez?** Comece por [`COMECE-AQUI.md`](../COMECE-AQUI.md) (instalação e uso sem jargão).
> Este documento é a referência dos comandos e campos — útil para quem quer entender ou rodar à mão.

Tudo roda **local**: Claude Code (ou Codex) + **Kie.ai** (vídeo, voz, pré-paga, sob demanda) +
**Remotion** (edição e render). Sem plataforma web. A chave da Kie.ai fica só no computador de
cada pessoa (variável de ambiente `KIE_API_KEY`) — nunca no repositório. O criativo é um
**`CreativeSpec`** (JSON) — o agente nunca "edita vídeo", ele escreve e reescreve o spec.
Contrato dos campos: [`render/src/spec.ts`](../render/src/spec.ts).

O **Higgsfield** continua disponível como alternativa guardada (mensalidade fixa com créditos
que zeram) — ver seção 5, "Alternativa: Higgsfield". A Kie.ai é o padrão porque cobra só o que
for gerado e o crédito não expira, o que combina melhor com um volume incerto (até ~130
clipes/mês, com meses sem uso).

Instruções que o agente segue: [`.claude/skills/criativo/SKILL.md`](../.claude/skills/criativo/SKILL.md)
(Claude Code) e [`AGENTS.md`](../AGENTS.md) (Codex e outros).

---

## 1. Pré-requisitos

- Node 22+, Git, `ffmpeg`/`ffprobe`, `yt-dlp` (referência por link)
- Python 3 + `python -m pip install faster-whisper` (legenda sincronizada e transcrição)
- Conta na Kie.ai com créditos + chave em https://kie.ai/api-key, exportada como
  `KIE_API_KEY` (`setx KIE_API_KEY "..."` no PowerShell, depois reabrir o terminal)
- `cd render && npm ci` uma vez
- Conferir tudo: `node tools/doctor.mjs` (checa a chave/saldo da Kie.ai; Higgsfield aparece como
  opcional — `npm i -g @higgsfield/cli` + `higgsfield auth login` + `higgsfield workspace set <id do plano pago>`
  só é necessário para quem usar a alternativa)

## 2. Fluxo completo

```bash
# 1. referência (opcional): arquivo ou link
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o entrada/ref.mp4 "<link>"
node tools/ingest-reference.mjs entrada/ref.mp4            # frames nos cortes + audio.wav em references/<nome>/
python tools/transcribe.py references/<nome>/audio.wav --lang pt   # o que é falado na referência

# 2. spec: copie um modelo de render/specs/_modelos/ e preencha (contexto em apps/<slug>/contexto.md)

# 3. material: b-roll e voz na Kie.ai (seções 5 e 6), gravações do app, anexos (seção 7)

# 4. legenda sincronizada com a voz (seção 6)
python tools/transcribe.py render/public/audio/<spec>-vo.mp3 --lang pt
node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<spec>-vo.words.json --fit-scenes

# 5. validar, preview, render, revisar
node tools/spec-tool.mjs check render/specs/<spec>.json
node tools/spec-tool.mjs props render/specs/<spec>.json
cd render && npx remotion still  src/index.ts Creative out/preview.png --frame=<n> --props=./specs/props/<spec>.json
cd render && npx remotion render src/index.ts Creative out/<nome>.mp4 --props=./specs/props/<spec>.json
node tools/review.mjs render/out/<nome>.mp4                 # folha de contato + análise de áudio
```

## 3. Modelos de vídeo

Em [`render/specs/_modelos/`](../render/specs/_modelos/LEIA-ME.md):

| Modelo | Quando usar |
|---|---|
| `ia-total` | não há material do app — tudo gerado (b-roll em todas as cenas) |
| `app-demo` | há gravação de tela do app — demo dentro do mockup de iPhone |
| `imagem-final` | vídeo gerado + imagem estática no fim (print da loja, oferta) |

Regras de todos: toda cena tem vídeo ou imagem; legenda karaokê sincronizada quando há voz;
transições e efeitos sonoros discretos; textos nas faixas padrão (hook no terço inferior-médio,
legenda embaixo, acima da interface das redes).

## 4. Contexto do app e regras de edição

- `apps/<slug>/contexto.md` — produto, público, dores, oferta, tom, marca (`brandKit`),
  **compliance**. Modelo em `apps/_modelo/`.
- `directors/<slug>.yaml` — ritmo, legenda, câmera, bloco `never` (vence brief e referência).

## 5. Vídeo com a Kie.ai

Ferramenta: [`tools/kie.mjs`](../tools/kie.mjs) (preços em [`tools/kie-precos.json`](../tools/kie-precos.json),
1 crédito = US$ 0,005). `gerar` só gasta saldo com `--sim`; sem essa flag mostra o custo e sai —
rode primeiro sem `--sim`, mostre o custo ao usuário, peça ok e só então repita com `--sim`.

```bash
node tools/kie.mjs saldo
node tools/kie.mjs modelos
node tools/kie.mjs custo   kling3 --duracao 5 --resolucao 720p
node tools/kie.mjs gerar   kling3 --prompt "..." --saida render/public/broll/<spec>-<cena>.mp4 \
  --duracao 5 --resolucao 720p --proporcao 9:16 --sim
# baixa o arquivo na hora (o link da Kie expira em 24h) e grava <arquivo>.kie.json
# layer generative_video: src = caminho relativo a render/public/, assetId = taskId, provider: "kie"
```

| Uso | Modelo | Custo aprox. (9:16, 720p, sem som) |
|---|---|---|
| b-roll de ação/ambiente (padrão) | `kling3` | 5s ≈ US$ 0,35 (com som ≈ US$ 0,50; 1080p sem som ≈ US$ 0,45) |
| b-roll mais rápido, sem som | `kling3-turbo` | 5s ≈ US$ 0,45 |
| pessoa falando para a câmera (fala/som nativos, padrão UGC) | `veo3-fast` (8s) | ≈ US$ 0,30–0,33 |
| mais barato, qualidade menor | `veo3-lite` (8s) | ≈ US$ 0,15 |
| plano principal de altíssima qualidade (só com pedido explícito) | `veo3-quality` (8s) | ≈ US$ 1,25 |
| animar uma foto real | `--imagem <arquivo>` em qualquer modelo (Kling: 1º quadro; Veo: 1º/último) | preço do modelo escolhido |

Prompt em inglês, estilo UGC real (iPhone na mão, luz natural, pessoa comum), nunca texto/logo/tela
de app no prompt. Veo entrega 720p; 1080p no Veo exige uma etapa extra ainda não automatizada.

**Limitação de áudio:** um clipe gerado com som (Kling `--audio` ou fala do Veo) toca em volume
cheio no vídeo final — ainda não há mixagem que abaixe esse som sob locução/música. Por isso: cena
com clipe de som próprio não leva locução (`karaoke`) nem música por cima; cenas com locução usam
clipe sem som (`kling3` sem `--audio`, ou `kling3-turbo`).

Não deixe a URL da Kie no `src` (expira em 24h) — o script já baixa sozinho.

### Alternativa: Higgsfield

Guardado para quem preferir mensalidade fixa (créditos zeram todo mês) em vez de pré-pago.
`npm i -g @higgsfield/cli` + `higgsfield auth login` + `higgsfield workspace set <id do plano pago>`.
Sempre `generate cost` antes e `create` só com ok (gasta créditos).

```bash
higgsfield account status
higgsfield model get kling3_0
higgsfield generate cost   kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off
higgsfield generate create kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off --wait --json
# baixe o result_url para render/public/broll/<spec>-<cena>.mp4 → layer generative_video: src, assetId, provider: "higgsfield"
```

| Uso | Modelo | Custo aprox. (9:16) |
|---|---|---|
| b-roll padrão | `kling3_0 --sound off` | 6,25 cr / 5s |
| plano principal mais nítido | `kling3_0_turbo --resolution 1080p` | 10 cr / 5s |
| pessoa falando para a câmera (fala nativa) | `veo3_1` (4/6/8s) | 11 cr / 4s |
| animar foto real | `kling3_0 --start-image <foto>` | 6,25 cr / 5s |
| referência de cenário/estilo | `seedance_2_0 --image-references <img>` | 22,5 cr / 5s |
| UGC com avatar (premium) | `marketing_studio_video` | ~75 cr / 15s |

Não deixe a URL do Higgsfield no `src` (expira em ~7 dias) — sempre baixe.

## 6. Voz e legenda sincronizada

```bash
# voz (se não houver gravação própria)
node tools/kie.mjs vozes
node tools/kie.mjs voz --texto "<roteiro falado>" --saida render/public/audio/<spec>-vo.mp3 \
  --voz "Ana Rita" --sim   # custo baixo (centavos de dólar); o script mostra o saldo antes/depois

# tempos por palavra (local, grátis; 1ª vez baixa ~460 MB)
python tools/transcribe.py render/public/audio/<spec>-vo.mp3 --lang pt

# legenda: uma layer karaoke por cena com o trecho falado; depois:
node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<spec>-vo.words.json --fit-scenes
```

**Alternativa: Higgsfield** — `higgsfield voices list`,
`higgsfield generate cost text2speech_v2 --prompt "<roteiro>" --variant elevenlabs --voice_id <id> --voice_type preset`
(~0,3 cr) ou `higgsfield generate cost inworld_text_to_speech --prompt "<roteiro>" --voice "Maitê (pt)"`
(~2 cr, ou "Heitor (pt)"); `create` com os mesmos flags `--wait --json` → `render/public/audio/<spec>-vo.mp3`.

- `audio.voiceover`: `src`, `atMs` (quando começa), `durationMs` (duração do arquivo), `script`.
- `sync-captions` preenche `wordEndsMs` (fim de cada palavra) casando legenda e fala em ordem.
- `--fit-scenes` ajusta a duração das cenas faladas para cortar no ritmo da voz (entre a última
  palavra de uma cena e a primeira da próxima). Sem ele, `warnings` aponta fala fora da cena.
- `audio.music` com `duckingDb` abaixa a música enquanto a voz fala. Sem música de terceiros.
- Trocar a voz de um vídeo pronto: só pela alternativa Higgsfield, workflow `voice_change`
  (a Kie.ai ainda não tem esse recurso).

## 7. Material próprio: app, anexos, Google Drive

| Onde fica | Para quê |
|---|---|
| `entrada/` (fora do git) | material bruto que o usuário arrasta |
| `G:\My Drive`, `G:\Shared drives` | Google Drive para computador — lido como pasta local |
| `render/public/app/<slug>/` | gravações de tela e prints usados no vídeo |
| `render/public/broll/` | clipes gerados ou vídeos reais em tela cheia |
| `render/public/audio/` | locuções e `.words.json` |
| `render/public/sfx/` | efeitos sonoros |

O spec **nunca** aponta para `entrada/` ou `G:\` — copie o arquivo usado para `render/public/`.

| Campo | Layer | Para quê |
|---|---|---|
| `src` | `generative_video`, `app_screen_recording` | caminho relativo a `render/public/` |
| `startFromMs` | `generative_video`, `app_screen_recording` | pula o começo do vídeo (`12000` = começa no 0:12) |
| `device: "none"` | `app_screen_recording` | vídeo/imagem em tela cheia, sem mockup |
| `prompt` | `generative_video` | obrigatório — em vídeo real, descreva o clipe |

Analisar anexo: `node tools/ingest-reference.mjs <vídeo>` (imagens) e `python tools/transcribe.py <vídeo>`
(fala). Gerar a partir de foto: `node tools/kie.mjs gerar kling3 --imagem <arquivo> ...` (alternativa
Higgsfield: `kling3_0 --start-image <arquivo>`). Rosto real só com autorização.

## 8. Edição

| Campo | Onde | Valores |
|---|---|---|
| `transitionIn` / `transitionMs` | cena | `cut` (padrão), `fade`, `zoom`, `whip`, `slide_up`, `flash` / 80–600 ms (padrão 250). Não muda a duração do vídeo |
| `audio.sfx[]` | spec | `{ src: "sfx/whoosh.mp3", atMs, volume }` — `whoosh`, `pop`, `click`, `rise` em `render/public/sfx/` |
| `anim` | layer | `none`, `pop_in`, `fade_in`, `slide_up`, `punch_in`, `tilt_scroll`, `handheld_subtle` |
| `preset` | layer `text` | `hook_stroke` (terço inferior-médio), `sub`/`caption` (faixa de legenda), `cta_label` |
| imagem estática | `app_screen_recording` com imagem e `anim: "none"` | zoom lento automático |

Detalhes do renderer: [`render/README.md`](../render/README.md).

## 9. Variações e idiomas

```bash
node tools/spec-tool.mjs variant render/specs/<pai>.json --mutation hook_rewrite --patch <patch>.json
node tools/spec-tool.mjs diff render/specs/<pai>.json render/specs/<filho>.json
```

Uma dimensão por variação: `hook_rewrite`, `hook_visual`, `pacing`, `cta`, `voice`, `persona`,
`format`, `locale_swap`. O patch traz só as cenas que mudam; clipes são reaproveitados.

Outro idioma: `locale_swap` com textos e karaokê adaptados → voz nova no idioma →
`transcribe.py --lang <en|es|...>` → `sync-captions --fit-scenes`. Vídeo com pessoa falando: gere de
novo no idioma com `veo3-fast` (fala nativa); só na alternativa Higgsfield há o workflow `dubbing`
pronto (`target_language`: por, spa, eng, fra, deu, ita...).

## 10. Validação

| Comando | O que acusa |
|---|---|
| `spec-tool validate` | estrutura do spec: gap/overlap de cenas, texto vazio, hook longo |
| `spec-tool check` | **errors:** cena sem vídeo/imagem, layer sem `src`, arquivo inexistente · **warnings:** clipe mais curto que a cena, legenda não sincronizada com a voz, voz além do fim do vídeo, vídeo sem legenda |
| `tools/review.mjs <mp4>` | folha de contato (quadros com tempo) + volume médio/pico e silêncios do áudio |

## 11. Criativos que deram certo (Meta Ads)

Servidor MCP **oficial** da Meta, já configurado em `.mcp.json`:

| Item | Valor |
|---|---|
| URL | `https://mcp.facebook.com/ads` (HTTP) |
| Login | OAuth (Facebook Login for Business) com registro automático de cliente — sem app Meta próprio nem token |
| Conectar | no Claude Code: `/mcp` → `meta-ads` → Authenticate (ou `claude mcp login meta-ads`) |
| Relatório | `ads_get_ad_entities` (campanha/conjunto/anúncio, gasto, impressões, CTR, CPC, CPM, conversões, período, breakdowns), `ads_insights_performance_trend` |
| Segurança | Meta Business Suite → Configurações → Integrações → Ads MCP server: bloquear criar campanhas e editar orçamento |

Fluxo: ranking com volume mínimo → vídeo do criativo → `ingest-reference` + `transcribe.py` → ficha em
`referencias/<slug>/<ad_id>.md` → variações. A doc da Meta não garante métricas de vídeo nem URL do
vídeo em todas as ferramentas — se faltar, usar o arquivo original.

### Opções para descobrir o que deu certo

| Opção | O que traz | Login/chave | Custo | Quando usar |
|---|---|---|---|---|
| **Meta Ads MCP oficial** (padrão) | métricas reais por anúncio (gasto, impressões, CTR, conversões) e detalhes do criativo | OAuth de cada pessoa via `/mcp` | grátis | anúncios da empresa no Facebook/Instagram |
| **Windsor.ai MCP** | Meta Ads, **TikTok Ads**, **Instagram e TikTok orgânicos**, quartis de vídeo; sem URL do vídeo | OAuth na conta Windsor (conector "Windsor.ai" nas configurações do claude.ai) | plano grátis (1 fonte, 30 dias) ou pago a partir de ~US$19/mês | precisar de TikTok ou orgânico junto |
| **CSV do Gerenciador de Anúncios** | as colunas que você exportar | nenhum | grátis | sem conexão, análise pontual (seção "Análise de performance" da skill) |
| **`yt-dlp` em posts orgânicos** | views, likes, data e o vídeo de TikTok/YouTube | nenhum (Instagram costuma exigir cookies do navegador e falha com frequência) | grátis | ver o que bombou no orgânico |
| **Biblioteca de Anúncios da Meta** | anúncios **ativos** de qualquer página + vídeo; sem métricas (sinais: tempo no ar, "N ads use this creative") | nenhum | grátis | olhar concorrentes — só consulta pontual: os termos da Meta proíbem coleta automatizada |
| **TikTok Creative Center** (Top Ads) | anúncios em alta no TikTok por nicho | nenhum | grátis | referência de mercado; sem API |
| **Plataforma web (futuro)** | ranking automático diário, vídeos vencedores baixados e analisados no servidor, time vê na web e o Claude local puxa as fichas | **token de leitura da Meta (System User, `ads_read`) guardado só no servidor** | VPS + manutenção | quando o volume pedir ranking automático sem ninguém pedir |

**Sobre a plataforma:** o servidor já tem módulos de métricas e ingestão de referência (`server/`),
mas está fora de uso. Um servidor não usa o login OAuth do MCP (que é por pessoa), por isso a
coleta automática exige o token server-side. O formato das fichas (`referencias/<slug>/<ad_id>.md`)
é o mesmo nos dois caminhos — dá para começar local e migrar sem perder nada.

## 12. Compartilhar

Specs, contextos, clipes (`render/public/`) vão para o GitHub. Não vão: `entrada/`,
`references/`, `render/out/` (MP4 finais — mande pelo canal da equipe).

---

A plataforma web (`web/`, `server/`, `DEPLOY.md`, `docs/ATIVACAO-IA.md`) está **fora de uso** por
enquanto.
