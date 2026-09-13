# Como usar — passo a passo

> **Primeira vez?** Comece por [`COMECE-AQUI.md`](../COMECE-AQUI.md) (instalação e uso sem
> jargão). Este documento é a referência detalhada.

Duas formas de trabalhar, com o **mesmo** modelo (tudo é um `CreativeSpec` JSON renderizado
pelo Remotion): pela **plataforma** (web, no VPS) e **local** (agente de IA — Claude Code ou
Codex). Dá pra misturar: ingerir a referência na plataforma e escrever o spec local, ou o
contrário.

---

## A) Plataforma (web)

- **Web:** https://creativebuilder.paywallo.com.br
- **API:** https://creativebuilder.lucasqueiroga.shop (`/health` → `{"ok":true,"db":true}`)

Ferramenta interna: sem cadastro aberto, um admin cria as contas.

### 1. Entrar
Acesse a URL e faça login. (Primeira conta do sistema nasce admin; contas novas são criadas
por um admin — ver seção C.)

### 2. Criar um App
`novo app` → nome (ex: *TapFit*), slug e nicho. O App agrupa referências, criativos e a
direção (ritmo/estilo) daquela marca.

### 3. Mandar uma referência (opcional, mas recomendado)
Abra o App → seção **Referências** → envie um **vídeo** ou cole um **link**
(Instagram/TikTok/YouTube ou URL direta de mp4). O servidor baixa, detecta os cortes e extrai
frames + áudio. Quando o status vira **pronta**, aparece duração, nº de cortes, ritmo
(s/cena) e nº de frames. Isso é a *estrutura* da referência — nunca a marca dela.

### 4. Criar um Criativo
`novo criativo` → escolha o App e um nome. Ele nasce com um esqueleto válido (hook + CTA) e
abre o **editor**.

### 5. Editar
No editor: à esquerda o **JSON do spec** (cenas, textos, cores, timing), à direita o
**preview ao vivo**. Ajuste e clique **salvar nova versão** (cada save é uma versão, com
histórico). O contrato dos campos está em `render/src/spec.ts`.

### 6. Renderizar / exportar
**renderizar still** (uma imagem, rápido, pra conferir) e depois **renderizar MP4**. Quando
fica pronto, o link baixa o arquivo final (1080×1920, h264).

### 7. Variações
`POST /creatives/:id/variations` cria um filho mudando **uma** dimensão (hook, cta, pacing,
locale…), pra você testar A/B e atribuir resultado à causa.

> **A IA não roda na plataforma.** Escrita/ajuste do spec e b-roll (`generative_video`) são
> feitos no modo local (B), pelo Claude Code — o servidor não tem chave de IA, e os botões
> "Gerar criativo com IA", "Ajustar com IA" e "gerar b-roll" respondem com aviso. Todo o resto
> do Remotion (texto, legenda, mockup, CTA, áudio) renderiza na plataforma. Criativo **com
> b-roll** gerado local: renderize o MP4 local (ver `docs/ATIVACAO-IA.md`).

---

## B) Local (agente de IA) — Claude Code **ou** Codex

Roda da raiz do repositório. As instruções do fluxo estão em `AGENTS.md` (Codex e qualquer
agente) e em `.claude/skills/criativo/SKILL.md` (Claude Code). Os dois apontam para os mesmos
scripts `node`.

### Pré-requisitos
- Node 22+, `ffmpeg` e `ffprobe` no PATH, e `yt-dlp` (para links).
- `cd render && npm ci` uma vez (Remotion).

### Claude Code
1. Abra o repositório com o Claude Code — ele carrega o skill `criativo` automaticamente.
2. Peça em linguagem natural: *"faz um criativo pro TapFit a partir desta referência: <link>"*
   ou *"gera 3 variações de hook do spec X"*.
3. O agente ingere a referência, lê os frames, escreve/ajusta o spec, renderiza o preview,
   te mostra e então gera o MP4.

### Codex
1. Abra o repositório com o Codex — ele lê o `AGENTS.md` na raiz.
2. Peça a mesma coisa em linguagem natural. O `AGENTS.md` tem os comandos exatos
   (`tools/ingest-reference.mjs`, `tools/spec-tool.mjs`, `npx remotion render`).

### Os comandos por trás (rodam com qualquer agente, ou à mão)
```bash
# 1. Referência (arquivo ou link)
node tools/ingest-reference.mjs "/caminho/video.mp4"
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o /tmp/ref.mp4 "<link>" && node tools/ingest-reference.mjs /tmp/ref.mp4

# 2. Validar + preview + render
node tools/spec-tool.mjs validate render/specs/<spec>.json
node tools/spec-tool.mjs props    render/specs/<spec>.json
cd render && npx remotion still  src/index.ts Creative out/preview.png --frame=30 --props=./specs/props/<spec>.json
cd render && npx remotion render src/index.ts Creative out/final.mp4     --props=./specs/props/<spec>.json

# 3. Variação (uma dimensão)
node tools/spec-tool.mjs variant render/specs/<pai>.json --mutation hook_rewrite --patch <patch>.json
node tools/spec-tool.mjs diff render/specs/<pai>.json render/specs/<filho>.json
```

### Gerar b-roll com o Higgsfield (CLI ou MCP)

O b-roll de IA é gerado **pelo agente, na sua máquina**, pela sua conta Higgsfield (OAuth no
navegador) — **sem API key**. O CLI basta; o MCP é opcional. Setup uma vez:

```bash
npm i -g @higgsfield/cli
higgsfield auth login          # abre o navegador
higgsfield account status      # confere login, plano e créditos
```

MCP (opcional): adicione `https://mcp.higgsfield.ai/mcp` via `claude mcp add` ou no
`.mcp.json` do projeto (Codex: nas configurações de MCP dele). Confirme URL/transport na doc
do Higgsfield, que muda com frequência.

Os comandos que o agente roda (você também pode rodar à mão):

```bash
higgsfield model list --video                  # modelos
higgsfield model get kling3_0                  # params aceitos
higgsfield generate cost   kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off
higgsfield generate create kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off --wait --json
```

Referência de custo (9:16, 5s): Kling 3.0 com `--sound off` 7.5 créditos (10 com som),
Kling 3.0 Turbo 7.5, Grok Video 7.5 (3s: 4.5), Seedance 2.0 Mini 12.5, Wan 2.6 13. O plano
free tem 10 créditos — dá ~1 clipe.

Fluxo: você pede o criativo → o agente escreve o spec → mostra o custo e pede ok → gera o
b-roll → baixa para `render/public/broll/` → preenche `src`/`assetId` na layer → renderiza.

### Material do app (gravação de tela e prints)

Coloque os arquivos em `render/public/app/<app>/` (ex: `render/public/app/tapfit/`) e peça
ao agente para usar. Na layer `app_screen_recording`, `"src": "app/tapfit/<arquivo>"` aceita
**vídeo** (`.mp4/.mov/.m4v/.webm`, toca mudo dentro do mockup de iPhone) ou **imagem**
(`.png/.jpg`); `"device": "none"` tira o mockup.

- **Com material do app:** as cenas de demo mostram a tela real.
- **Sem material do app:** o criativo sai com b-roll + texto + CTA, sem tela do app. A UI do
  app **nunca** é gerada por IA.

---

## C) Passar para outros usarem

Interna, sem cadastro aberto — o admin cria a conta de cada pessoa:

```bash
TOKEN=$(curl -s -X POST https://creativebuilder.lucasqueiroga.shop/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"SEU_ADMIN","password":"SUA_SENHA"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -X POST https://creativebuilder.lucasqueiroga.shop/auth/users \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"pessoa@empresa.com","password":"senha-forte","name":"Nome"}'
```

Depois é só passar o link `https://creativebuilder.paywallo.com.br` + o login. Para o modo
local, a pessoa precisa do repositório clonado + Claude Code ou Codex.
