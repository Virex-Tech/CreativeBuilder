# Creative Engine — geração automatizada de criativos para apps

Plano de arquitetura. Objetivo: dado um **brief** ou uma **referência** (vídeo/imagem),
produzir criativos prontos para publicar (vídeo e post), gerar variações controladas,
publicar via Meta/IG, ler as métricas e decidir o que matar, escalar ou variar.

Formato-alvo confirmado nos exemplos existentes (`C:\work\TapFit - *.mp4`):
**1080×1920, 30fps, h264 + AAC estéreo, 20–55s**.

---

## 0. Decisão estrutural

**Produto separado, em `creativebuilder`.** O Creative Engine é outra solução — não uma feature
do payposts. Ele nasce autônomo, com banco, filas e API próprios, e o payposts integra
depois **como cliente**, quando o engine estiver de pé.

Isso muda o que o payposts significa aqui: ele deixa de ser a casa e passa a ser
**referência de implementação e primeiro consumidor**. Nada é editado lá (ver §15 para o
que vale portar).

Três serviços:

| Serviço | Papel | Por quê separado |
|---|---|---|
| `api` | domínio: spec, referências, variações, playbook, métricas | o cérebro; stateless na frente de Postgres + Redis |
| `creativebuilder-worker` | jobs: geração de asset, render, ingestão de métricas | trabalho longo e caro não pode compartilhar processo com a API |
| `render` | Remotion → MP4/PNG | precisa de Chrome headless e CPU dedicada; escala em eixo próprio |

O `my-video` (Remotion 4.0.441, `PaywalloReel` 1080×1920 já componentizado) vira a
semente do `render`.

**Integração com o payposts, depois**: HTTP + webhook, não biblioteca compartilhada.
O payposts chama `POST /creatives`, recebe o `creativeId`, e o engine avisa a conclusão por
webhook. Assim as duas bases evoluem sem se amarrar, e o engine pode servir outros clientes
além do payposts.

---

## 1. O conceito central: **CreativeSpec**

Tudo gira em torno de um **JSON versionado** que descreve o criativo inteiro.
A IA nunca "edita vídeo" — ela **escreve e reescreve esse JSON**. O Remotion é uma
função `CreativeSpec -> MP4`.

É isso que torna o resto barato: *variação = diff no spec*, *duplicar = clone + patch*,
*ajustar = editar um campo e re-renderizar*. Determinístico, diffável, versionável, auditável.

```jsonc
{
  "specVersion": "1",
  "creativeId": "cr_01J...",
  "appId": "app_tapfit",
  "lineage": { "parentId": "cr_01H...", "mutation": "hook_rewrite" },
  "format": { "w": 1080, "h": 1920, "fps": 30, "durationMs": 21000 },
  "brandKit": { "ref": "bk_tapfit_v2" },        // fontes, cores, logo, estilo de legenda
  "audio": {
    "voiceover": { "provider": "elevenlabs", "voiceId": "...", "script": "..." },
    "music": { "assetId": "as_...", "duckingDb": -14 }
  },
  "captions": { "style": "karaoke_bold", "source": "voiceover_alignment" },
  "scenes": [
    {
      "id": "hook",
      "role": "HOOK",                            // HOOK|PROBLEM|DEMO|PROOF|CTA
      "startMs": 0, "durationMs": 2200,
      "layers": [
        { "type": "generative_video",
          "prompt": "mulher fitness olhando o celular, luz natural",
          "provider": "higgsfield", "assetId": "as_gen_...", "fit": "cover" },
        { "type": "text", "content": "Seu treino nunca mais igual",
          "preset": "hook_stroke", "anim": "pop_in" }
      ]
    },
    {
      "id": "demo", "role": "DEMO", "startMs": 2200, "durationMs": 9000,
      "layers": [
        { "type": "app_screen_recording", "assetId": "as_scr_treino",
          "device": "iphone15_mock", "anim": "tilt_scroll" },
        { "type": "text", "content": "Sorteia o treino do dia", "preset": "sub" }
      ]
    },
    { "id": "cta", "role": "CTA", "startMs": 11200, "durationMs": 4000,
      "layers": [{ "type": "component", "name": "StoreCTA", "props": { "badge": "app_store" } }] }
  ]
}
```

**Camada generativa vs. camada determinística** — a divisão que faz o resultado parecer
bem feito em vez de genérico:

- **Higgsfield / fal.ai** → b-roll, atores, lip-sync, cenas que precisam parecer reais.
- **Remotion** → tudo que precisa estar *exato*: mockup do app, screen recording,
  legendas com timing, textos, transições, logo, CTA, safe areas de cada rede.

Nunca peça texto ou UI ao modelo generativo. Ele erra letra e o vídeo morre.

---

## 2. Superfície de controle — como você instrui o vídeo

Sim: dá para dirigir o vídeo com precisão. Mas a instrução precisa entrar na **altitude
certa**, senão você repete a mesma correção em todo vídeo pra sempre. Quatro níveis:

### 2.1 Nível 1 — Direção permanente (`DirectorProfile`, por App)

As regras de edição que valem para **todo** vídeo daquele app. Escritas uma vez, em YAML
editável, versionadas junto do brand kit. É aqui que mora o "nosso estilo".

```yaml
director: tapfit_v1
pacing:
  cut_every_ms: [900, 1600]        # ritmo de corte alvo
  hook_max_ms: 2500
  scene_min_ms: 700
transitions:
  allowed: [hard_cut, whip_pan, match_cut]
  forbidden: [crossfade, zoom_blur]
captions:
  style: karaoke_bold
  position: lower_third
  max_chars_per_line: 24
  always_on: true                  # sempre legenda, som off é o default do feed
typography: { hook: display_800, body: sans_600 }
camera:
  app_screen: [tilt_scroll, punch_in]
  generative: [handheld_subtle]
audio:
  music_energy: high
  vo: { gender: female, age: young_adult, pace: fast }
  duck_db: -14
b_roll_policy: { prefer: asset_library, generate_if_missing: true }
never:
  - "texto renderizado dentro de imagem gerada por IA"
  - "mais de 2 frases por cena"
  - "logo antes dos 3s"
  - "claim numérico sem fonte"     # compliance de ads
```

O `never` é tão importante quanto o resto: é como você impede o sistema de repetir um
erro, sem precisar revisar cada vídeo.

### 2.2 Nível 2 — Estrutura (Template / Blueprint)

Vem da referência (§4) ou é escrita à mão: os beats, a ordem, a duração de cada um, o que
acontece em cada cena. Reutilizável entre apps e nichos.

### 2.3 Nível 3 — Brief do vídeo (linguagem natural, pontual)

O que muda de um vídeo para o outro. Chat, MCP ou formulário:

> "Faz um sobre o treino aleatório. Hook provocativo mirando quem abre a academia e não
> sabe o que treinar. 20s, VO feminina, termina com prova social. Usa o screen recording
> `as_scr_treino`."

Claude traduz isso em `CreativeSpec` **respeitando** os níveis 1 e 2 — o brief não pode
furar o `never` nem o brand kit.

### 2.4 Nível 4 — Spec, campo a campo

Controle cirúrgico quando você quiser: editar o JSON direto, pela UI de timeline, ou por
chat. Tudo que o Remotion sabe fazer está exposto como campo — duração, easing, posição,
tamanho de fonte, ponto de corte, volume, prompt de cada b-roll.

---

### 2.5 Ajuste depois de pronto

Vídeo renderizado não é ponto final — é uma versão do spec. Correções em linguagem
natural viram **patch no spec** e re-render:

| Você diz | Vira |
|---|---|
| "encurta o hook pra 1.8s" | `scenes[hook].durationMs = 1800` (+ reflow dos beats seguintes) |
| "troca a cena 3 por academia cheia de manhã" | novo `prompt` na layer generativa → novo asset |
| "legenda maior e mais pra cima" | `captions.position/size` |
| "tira a música, deixa só o VO" | `audio.music = null` |
| "mesma coisa mas versão 4:5 de 15s" | novo spec com `format` + `durationMs` alterados |

Cada patch gera um **diff visível** antes de rodar. Você aprova a mudança, não descobre
depois de gastar render.

### 2.6 Preview antes de gastar

Antes do render completo: `renderStill` de 3–5 frames-chave + a timeline em texto
(beats, durações, textos na tela, cortes). Custa centavos e pega 90% dos erros de direção.
Só depois vai para MP4.

### 2.7 Instrução repetida vira regra

Se a mesma correção aparece 3 vezes em vídeos diferentes do mesmo app, o sistema **sugere
promover** aquilo para o `DirectorProfile`. É assim que o estilo da casa é aprendido de
verdade, em vez de ficar preso no histórico de um chat.

---

## 3. Pipeline

```
BRIEF ou REFERÊNCIA
        ↓
[1] Blueprint  — Claude lê referência/brief + Persona + Playbook → estrutura de beats
        ↓
[2] Spec       — Claude preenche o CreativeSpec (roteiro, prompts, textos)
        ↓
[3] Assets     — jobs paralelos: Higgsfield/fal (b-roll) · ElevenLabs (VO) · alinhamento de legenda
        ↓
[4] Render     — payposts-render (Remotion) → MP4 + thumb + variantes de aspecto
        ↓
[5] Approval   — domínio já existe: humano aprova, ou auto-aprova por regra
        ↓
[6] Publish    — InstagramPostingAdapter / Meta Ads (upload de creative)
        ↓
[7] Measure    — MetricsIngestJob puxa Graph API + Ads Insights de hora em hora
        ↓
[8] Decide     — motor de regras + Claude → KILL / SCALE / VARY(dimensão)
        ↓ (volta ao [2] com lineage.parentId)
```

Cada etapa é uma fila BullMQ separada, com retry e DLQ próprios. Um render que falha
não pode reprocessar a geração de asset — isso custa dinheiro.

---

## 4. Ingestão de referência

O fluxo do WhatsApp ("só mandar a referência → 10 min fica pronto") é isto:

1. Recebe URL (IG/TikTok — o `domain/scraping` já baixa) ou upload direto.
2. **Análise multimodal** (Gemini / Claude vision — ambos já configurados): extrai por
   segmento → transcrição, texto na tela e quando aparece, cortes (timestamps),
   enquadramento, ritmo, e o *papel narrativo* de cada beat.
3. Sai um **ReferenceBlueprint**: a estrutura, não o conteúdo.
   `HOOK 0–2.4s (pergunta provocativa, texto grande centralizado) → PROBLEM 2.4–5s →
   DEMO 5–14s (screen rec, 4 cortes) → CTA 14–18s`
4. O blueprint vira **Template** reusável e nichado.
   `Befit 1085752810596905 → "Treino aleatório (Bella)"` é literalmente
   `templateId + persona + appId` — o mesmo par que já produziu os MP4 em `C:\work`.
5. Aplicar o template a outro app/nicho = re-preencher o spec mantendo o esqueleto.

**Regra de qualidade e jurídica**: copia-se *estrutura e ritmo*, nunca frames, áudio ou
marca da referência.

`ReferenceAsset` também aceita material próprio do cliente (screen recordings, fotos do
produto, logo, footage de marca) — vai para a asset library do `App`, e o spec referencia
por `assetId`.

---

## 5. Higgsfield

Não há SDK oficial estável — tratar como client HTTP próprio, atrás do `ProviderRouter`
que já existe:

```
infrastructure/ai/video/HiggsfieldClient.ts
  submit(prompt | imageRef | lipSync) -> providerJobId
  poll(providerJobId) -> { status, url }
```

- Assíncrono e caro → job BullMQ dedicado, com **cache por hash de prompt+params**
  (mesmo prompt = mesmo asset, não paga duas vezes).
- **Budget guard por App**: teto de gasto/dia; estourou, a fila para e avisa.
- `ProviderRouter` decide Higgsfield vs. fal por tipo de cena (lip-sync → Higgsfield),
  custo, e fallback se um provider cair.
- Todo asset gerado entra na **AssetLibrary** junto com o prompt que o gerou →
  reaproveitável em outros criativos sem re-gerar.

---

## 6. payposts-render (serviço Remotion)

```
payposts-render/
  src/
    Root.tsx                 # registra a composição genérica
    SpecRenderer.tsx         # <SpecRenderer spec={CreativeSpec}/>  ← única composição
    layers/                  # TextLayer, VideoLayer, AppScreen, PhoneMockup, Captions...
    presets/                 # animações e estilos de texto nomeados (referenciados no spec)
    brandkits/               # tokens por app
  server.ts                  # POST /render {spec} -> jobId ; GET /render/:id
```

Pontos que decidem se isso escala:

- **Uma composição só.** `calculateMetadata` deriva duração e dimensão do spec.
  Nada de uma composição por vídeo — é aí que projetos Remotion viram inviáveis.
- `--concurrency` por CPU; container próprio com Chrome; fila separada da API.
- **Preview barato**: `renderStill` de 3 frames-chave para IA/humano validar *antes* de
  gastar o render completo.
- Multi-aspecto no mesmo spec: 9:16, 1:1, 4:5 via `format`, com safe areas por rede.
- Remotion Lambda depois, para picos. Comece com container: mais simples e previsível.

---

## 7. Variações — as dimensões

Variar tudo de uma vez não ensina nada. Uma variação **muda uma dimensão e registra qual**,
via `lineage.mutation`. É assim que a métrica consegue atribuir a causa.

| Dimensão | O que muda | Quando usar |
|---|---|---|
| `hook_rewrite` | só os 0–3s | hook rate baixo |
| `hook_visual` | mesma copy, outro b-roll no hook | hook rate baixo, copy já validada |
| `pacing` | duração dos beats, nº de cortes | hold rate cai no meio |
| `cta` | oferta, texto, badge | CTR baixo com hold bom |
| `voice` | outro VO / sem VO / só música | teste de canal |
| `persona` | outro avatar ou tom | escalar vencedor |
| `format` | 9:16 → 4:5, versão curta | novo placement |

O domínio `spray` que já existe é exatamente o lugar de disparar N variações de uma dimensão.

---

## 8. Loop de métricas e regras de teste

> "como ensinar essa IA as nossas regras de testes de criativos e quais métricas analisar"

### 8.1 Atribuição — o pré-requisito

Sem isso o loop inteiro é ficção. O `creativeId` precisa sobreviver até o dado voltar:

- nome do ad = `{appId}__{creativeId}__{mutation}` (parseável na volta)
- `utm_content = creativeId`
- tabela `CreativeMetric(creativeId, source, capturedAt, window, metrics jsonb)`
- posts orgânicos: `ig_media_id ↔ creativeId` gravado no momento da publicação.
- **um ad por criativo. Nunca Dynamic Creative.** Os breakdowns por asset
  (`video_asset`, `body_asset`, `title_asset`) não funcionam para assets em Dynamic
  Creative — usá-lo destruiria a atribuição por criativo, que é a base do loop.

> **Limite real, validado (set/2026).** No iOS, SKAdNetwork e AEM reportam **agregado no
> nível de campanha / ad set — não de criativo**. MMP (AppsFlyer/Adjust) só *infere*
> criativo decodificando o `source_identifier` de 4 dígitos do SKAN 4, e essa inferência
> degrada exatamente no nosso cenário: muitos criativos em teste = pouco volume por ID =
> crowd anonymity devolvendo valor "coarse" ou `null` (mercado cita ~40–50 installs/dia
> por campaign ID como piso). Android tende a ser melhor, mas não foi confirmado com
> fonte primária de 2026 (Privacy Sandbox).
>
> **Consequência:** o loop automático **não fecha em CPA/install por criativo.**
> Ver §8.3 para o que ele usa no lugar.

### 8.2 Métricas — em funil, não em lista

Campos confirmados na doc oficial de Ads Insights (set/2026):
`impressions`, `spend`, `cpm`, `frequency`, `video_play_actions`,
`video_continuous_2_sec_watched_actions`, `video_6_sec_watched_actions`,
`video_30_sec_watched_actions`, `video_p25/p50/p75/p95/p100_watched_actions`,
`video_avg_time_watched_actions`.

`video_3_sec_watched_actions` e `video_thruplay_watched_actions` são citados amplamente
mas **não foram confirmados na doc primária** — usar `video_continuous_2_sec` como
numerador de hook, que está confirmado. A métrica de *10-second view* foi **descontinuada
em 26/01/2026**.

| Etapa | Métrica | Confiável por criativo? | O que acusa |
|---|---|---|---|
| Entrega | `cpm`, `frequency`, `spend` | ✅ sim | saturação / custo de mídia |
| Atenção | **Hook rate** = `video_continuous_2_sec` ÷ `impressions` | ✅ sim | os primeiros 2s |
| Retenção | **Hold rate** = `video_p75` ÷ `video_play_actions` | ✅ sim | corpo do vídeo, ritmo |
| Retenção grossa | quartis `p25/p50/p75/p95/p100` | ✅ sim | em qual quarto o público cai |
| Intenção | CTR outbound | ✅ sim | oferta e CTA |
| Conversão | CPI / CPA install | ❌ **não** (só campanha/adset) | — |
| Valor | CPA trial, D1/D7, ROAS | ❌ não por criativo | — |
| Orgânico | `views`, `reach`, `saved`, `shares`, `ig_reels_avg_watch_time` | ✅ sim | potencial viral |

**Hook rate e hold rate não são métricas oficiais da Meta** — são convenções de mercado
derivadas dos campos acima. Fixar a fórmula em um lugar só do código e versioná-la, senão
as baselines viram lixo quando alguém mudar o denominador.

**Diagnóstico posicional** — hook ruim, corpo ruim e oferta ruim exigem consertos
diferentes, e é a queda entre quartis que diz qual dos três é o problema.
**Não existe curva por segundo para ads**: só os quartis. (Vídeo orgânico de Página tem
`total_video_retention_graph` em 40 intervalos; Reels expõe apenas
`ig_reels_avg_watch_time` e tempo total.) O diagnóstico é mais grosso do que o ideal, mas
p25→p50→p75→p95 é suficiente para separar "morreu no hook" de "morreu no meio" de
"chegou ao fim e não clicou".

**Restrições de query confirmadas**: campos `video_*` não podem ser combinados com
breakdown horário, e `video_p25`–`p100` não suportam breakdown por região. Polling de hora
em hora continua válido — o que não dá é *segmentar por hora*.

### 8.3 Como as regras são ensinadas

As regras são **dados editáveis**, não prompt escondido. Um `TestingPlaybook` por App
(o model `Playbook` já existe, com versionamento) em YAML:

```yaml
playbook: tapfit_v3
guardrails:
  min_impressions: 2000        # nada decide antes disso
  min_spend_usd: 20
  min_hours: 24                # respeita a learning phase da Meta
baselines:                     # calculados do histórico do próprio App, não chutados
  hook_rate: p50
  ctr_outbound: p50
rules:
  - id: kill_dead_hook
    when: "hook_rate < baseline.hook_rate * 0.6"
    then: { action: KILL, then_generate: { mutation: hook_rewrite, n: 4 } }
    why: "ninguém passa dos 2s; o resto do vídeo é irrelevante"
  - id: fix_body
    when: "hook_rate >= baseline.hook_rate AND hold_rate < 0.25"
    then: { action: VARY, mutation: pacing, n: 3 }
  - id: fix_offer
    when: "hold_rate >= 0.35 AND ctr_outbound < baseline.ctr_outbound * 0.7"
    then: { action: VARY, mutation: cta, n: 3 }
  - id: scale_winner
    # NÃO usa cpa_install: não é atribuível por criativo (§8.1).
    # Fecha em engajamento + custo, que são confiáveis no nível de ad.
    when: "hook_rate >= baseline.hook_rate * 1.3
           AND ctr_outbound >= baseline.ctr_outbound * 1.2
           AND cpm <= baseline.cpm * 1.1"
    then: { action: SCALE, budget_step: 1.2, and: { mutation: persona, n: 2 } }
    why: "duplica o vencedor variando só a persona pra achar o próximo"
    gate: campaign_cpa_ok   # CPA agregado da campanha como trava, não como critério
  - id: fatigue
    when: "frequency > 2.5 AND cpm_delta_7d > 0.25"
    then: { action: REFRESH, mutation: hook_visual, n: 3 }
```

**Divisão de trabalho, deliberada:**

- **Motor determinístico** avalia as regras. Decisões de dinheiro (matar, escalar
  orçamento) são código — auditáveis e testáveis. Nunca um LLM decidindo budget sozinho.
- **Claude** faz o que regra não faz: lê a curva de retenção + o spec + os vencedores
  históricos do nicho e **escreve as variações**, explicando a hipótese de cada uma.
- Toda decisão grava `DecisionLog(creativeId, ruleId, metrics, action, outcome)`.
  Com isso dá para medir a *taxa de acerto de cada regra* e afinar o playbook com dado.

**Memória por nicho**: o `ai-memory` + embeddings que já existem guardam o que funcionou
em fitness / finanças / produtividade — hooks vencedores, ritmos, ofertas. Cada novo
brief começa com esse contexto, não do zero.

**Autonomia em níveis** (por App, configurável): `SUGGEST` → `AUTO_CREATE` (gera e espera
aprovação) → `AUTO_PUBLISH_ORGANIC` → `AUTO_ADS` (dentro de teto de budget).
Ninguém nasce no nível 4.

---

## 9. MCP — controle pelo Claude Code

O `domain/mcp` já existe. Expor o Creative Engine como **MCP server** dá exatamente o
fluxo do print ("ela tem o MCP do Claude, ela gera os vídeos"):

```
list_apps · get_brand_kit
ingest_reference(url|file) -> blueprint
create_spec(brief|templateId, appId) -> spec
render_preview(spec) -> stills          # barato, valida antes de gastar
render(spec) -> mp4
create_variations(creativeId, mutation, n)
publish(creativeId, target)
get_metrics(creativeId|appId, window)
get_playbook · propose_decisions(appId)
```

Para os dados da Meta: usar o `MetaAdsClient` próprio como fonte de verdade (controle de
rate limit, cache, retry, refresh de token) e expor via MCP. Um MCP oficial da Meta, se
houver, entra como leitura conveniente — não como caminho crítico.

---

## 10. Lacunas bloqueantes (fechar antes de tudo)

1. **Object storage** — só existe `LocalStorage`. Implementar `S3Storage` (R2/S3) sobre a
   interface `IStorage` que já está lá. Vídeo em disco local não sobrevive a worker em container.
2. **Atribuição `creativeId` ponta a ponta** (§8.1). Sem isso, nada aprende.
3. **Budget guard** por App para as APIs generativas.
4. **Meta App Review** — permissões de publicação e insights levam semanas. Começar já.

---

## 11. Roadmap

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0** — 1 sem | S3Storage, `HiggsfieldClient` + job, budget guard, schema `Creative/CreativeSpec/Asset` | asset gerado sobrevive a restart |
| **1** — 2 sem | `payposts-render` com `SpecRenderer` e ~8 layers; porta o `PaywalloReel` para spec | um spec vira MP4 sem tocar em código |
| **2** — 1 sem | Ingestão de referência → blueprint → template | 1 referência gera 1 criativo aprovável |
| **3** — 1 sem | Variações por dimensão + `lineage` + UI de diff | 5 variações de hook em 1 clique |
| **4** — 2 sem | Publicação + `MetricsIngestJob` + atribuição + dashboard de funil | hook/hold/CTR por criativo |
| **5** — 2 sem | Playbook YAML + motor de regras + `DecisionLog` (modo SUGGEST) | sugestões batem com o julgamento humano |
| **6** | MCP server + autonomia gradual | ciclo fechado sozinho dentro do budget |

A fase 5 só começa quando houver volume de dado real da fase 4 — regra calibrada em dado
inventado é pior que nenhuma regra.

---

## 12. Posts estáticos e carrossel

O mesmo `CreativeSpec` cobre imagem e carrossel — muda o *output*, não o modelo:

```jsonc
"output": { "kind": "video" | "image" | "carousel" }
```

- **`image`** → uma cena, renderizada com `renderStill` em vez de `renderMedia`.
- **`carousel`** → cada cena vira um slide. `role` continua fazendo sentido
  (`HOOK` → capa, `POINT` → miolo, `CTA` → último card).
- Formatos: 1080×1350 (4:5, feed), 1080×1920 (story), 1080×1080 (1:1).

**Por que isso quase não custa código**: o Remotion já renderiza cada frame; um still é o
mesmo componente com `renderStill`. O domínio `slides` que já existe cobre a parte de
publicação de carrossel — o `SpecRenderer` só passa a ter dois modos de saída.

**Regra que muda**: em post estático o texto é o conteúdo, não um complemento. Toda a
tipografia vem da camada determinística; o generativo entra só como fundo/textura. Nunca
um card inteiro gerado por imagem.

**Métricas são outras** (§8.2): não existe hook rate nem hold rate. O funil de carrossel
mede `saved`, `shares`, e — quando disponível — profundidade de swipe. As regras de
decisão para `output.kind != "video"` precisam de baselines próprias, senão o motor
compara coisas incomparáveis.

---

## 13. Multi-idioma

Vocês já produzem em pt/en/es (`motion-pept-pt|en|es.mp4`). Hoje isso é vídeo do zero por
idioma; no spec vira uma dimensão de variação barata.

```jsonc
"locale": "pt-BR",
"localeGroupId": "lg_01J..."   // liga as versões irmãs
```

**`locale_swap` como mutação**: mantém cenas, cortes, b-roll e screen recording — regenera
só o que é linguístico (VO, legendas, textos na tela). Os assets caros são reaproveitados
por `assetId`; o custo fica na casa de 10% de um vídeo novo.

Três armadilhas que precisam estar no renderer, não no prompt:

1. **Texto muda de tamanho.** PT e ES correm 20–30% mais longos que EN. Os presets de
   texto precisam de `maxLines` + auto-shrink, senão a legenda estoura a safe area.
2. **VO muda de duração.** Cada cena declara `timing: "locked" | "flex"` — `locked` para
   o que sincroniza com a imagem (um corte, uma animação de UI), `flex` para o que pode
   respirar. As cenas `flex` absorvem a diferença.
3. **Lip-sync não sobrevive à troca.** Se houver avatar falando, mudar de idioma exige
   regerar o lip-sync — caro. Para conteúdo multi-idioma, prefira VO fora de cena; deixe
   o avatar falante para o idioma principal.

**Não comparar métricas entre idiomas.** Baselines por `locale`, sempre — CPM e CTR de
mercados diferentes não se comparam, e um "vencedor" global seria só o mercado mais barato.

Fora do vídeo, o `locale` também troca: badge da loja, moeda no CTA, e as regras de
compliance da região.

---

## 14. Camada concreta

### 14.1 Prisma — models novos

Seguindo as convenções que já existem (`@db.Uuid`, `@map` snake_case, `costMicrocents`):

| Model | Campos-chave |
|---|---|
| `Creative` | `userId`, `appId`, `templateId?`, `personaId?`, `locale`, `localeGroupId?`, `parentId?`, `mutation?`, `status`, `outputKind` |
| `CreativeVersion` | `creativeId`, `version`, `spec Json`, `specHash`, `createdBy` (`ai`/`human`) |
| `CreativeAsset` | `userId`, `appId`, `kind` (`GENERATED`/`REFERENCE`/`UPLOAD`/`RENDER`), `contentHash`, `url`, `prompt?`, `provider?`, `costMicrocents` |
| `CreativeTemplate` | `appId?`, `niche`, `blueprint Json`, `sourceReferenceId?` |
| `DirectorProfile` | `appId`, `version`, `profile Json`, `active` |
| `RenderJob` | `creativeVersionId`, `specHash`, `status`, `resultUrl`, `durationMs`, `costMicrocents` |
| `CreativeMetric` | `creativeId`, `source` (`META_ADS`/`IG_ORGANIC`), `capturedAt`, `window`, `metrics Json` |
| `DecisionLog` | `creativeId`, `ruleId`, `metricsSnapshot Json`, `action`, `outcome?`, `decidedAt` |
| `CreditLedger` | `userId`, `appId`, `provider`, `delta`, `reason`, `refId` |

`parentId` + `mutation` dão a linhagem; `specHash` dá idempotência de render.

### 14.2 API

```
POST   /creatives                      brief|templateId → cria Creative + v1
GET    /creatives/:id                  spec + versões + linhagem
PATCH  /creatives/:id/spec             patch → nova CreativeVersion (retorna diff)
POST   /creatives/:id/preview          stills dos frames-chave
POST   /creatives/:id/render           enfileira RenderJob
POST   /creatives/:id/variations       { mutation, n } → N filhos
POST   /creatives/:id/locales          { locales[] } → irmãos por idioma
POST   /references                     url|upload → blueprint → template
GET    /apps/:id/director-profile      GET/PUT do DirectorProfile
GET    /creatives/:id/metrics          funil por janela
POST   /apps/:id/decisions/propose     roda o playbook → ações sugeridas
```

### 14.3 Frontend (`payposts-web`)

Reaproveita o padrão `src/features/*` que já existe. Telas novas:
`dashboard/creatives` (grid + **árvore de linhagem**, que é o que mostra qual mutação
ganhou), editor de spec com timeline, inbox de referências, editor do DirectorProfile e do
playbook, e o dashboard de funil (hook → hold → CTR por criativo).

### 14.4 Testes

- **Schema do spec**: zod, com fixtures de spec inválido.
- **Golden frames**: `renderStill` em frames fixos, comparado por hash — pega regressão
  visual sem olho humano.
- **Motor de regras**: unitário com fixtures de métricas; cada regra tem caso que dispara
  e caso que não dispara (principalmente os guardrails).
- **Providers**: contract tests com HTTP mockado; nada de bater na API real em CI.
- **Storage**: já coberto pelos testes de integração que usam `LocalStorage`.

### 14.5 Observabilidade

O que precisa ser medido desde o dia 1, senão o custo escapa:

- **custo por criativo**: tokens + créditos de provider + minutos de render, somados no
  `CreditLedger` e expostos na tela do criativo;
- tempo por etapa do pipeline (onde a fila entope);
- taxa de falha por provider (para o `ProviderRouter` degradar sozinho);
- **taxa de acerto por regra** — `DecisionLog.outcome` comparado com o que aconteceu
  depois. É isso que transforma o playbook em algo afinável com dado.

---

## 15. Auditoria do payposts — o que vale portar

Verificado diretamente no código do `payposts-server` (não é estimativa). O payposts **não
é editado**: esta tabela diz o que serve de referência de implementação e o que vale
**portar** (copiar e adaptar) para o `creativebuilder`, em vez de escrever do zero.

Vale portar de imediato, por serem código maduro e independentes do domínio deles:
o padrão de env com zod (`optionalStr`), `AgentDefinition` (agente com schema zod de
saída), `IVideoGenerationProvider` + `FalVideoClient`, `ElevenLabsTtsClient`,
`BullJobQueue`, `JobLock`, `RedisClient` e a convenção `costMicrocents`.

Na coluna Ação: **Portar** = copiar do payposts e adaptar; **Referência** = olhar como
fizeram, mas escrever para o nosso modelo; **Novo** = não existe em lugar nenhum.

| Peça | Existe no payposts? | Onde (lá) | Ação |
|---|---|---|---|
| `CreativeSpec` / cenas / timeline | ❌ não | `video-generation` é one-shot prompt→vídeo | **Novo** |
| Template / blueprint de referência | ❌ não | — | **Novo** |
| Variação de criativo | ⚠️ só texto | `agents/definitions/SprayVariantAgent` (hook/caption/hashtags) | **Portar + estender** para dimensões de vídeo |
| Linhagem parent/child | ❌ não | nenhum model tem `parentId` | **Novo** |
| Regras "se métrica então ação" | ⚠️ limitado | `ads/services/AutoBoostEvaluator` + `AutoBoostRule` | **Portar + estender** |
| Infra de agente com schema | ✅ sim | `infrastructure/agents/AgentDefinition` + zod | **Portar** |
| Regras não-negociáveis (`never`) | ✅ parcial | `pinnedRules` do SprayVariantAgent | **Portar + estender** para edição |
| Job de vídeo + custo | ✅ sim | `VideoJob.costMicrocents` | **Portar** |
| Provider generativo de vídeo | ✅ sim | `IVideoGenerationProvider`, `FalVideoClient` | **Portar** |
| Higgsfield | ❌ não | — | **Novo** |
| TTS | ✅ sim | `ElevenLabsTtsClient` | Portar |
| Legendas / alinhamento | ❌ não | — | **Novo** |
| Render Remotion | ❌ não | `my-video` é CLI isolado | **Novo (serviço)** |
| Publicação IG | ✅ sim | `InstagramPostingAdapter` | Portar |
| Insights de ad | ⚠️ parcial | `MetaAdsClient` lê `impressions,clicks,spend,ctr,cpc,cpp,actions` no nível de ad | **Portar + estender** com campos `video_*` |
| Upload de vídeo como creative na Meta | ❓ não verificado | — | Verificar |
| Storage em nuvem | ❌ não | lá só existe `LocalStorage` | **Novo** (há implementação pronta, ver §17) |
| Budget guard | ❌ não | custo é registrado, mas nada trava | **Novo** |
| MCP server | ❓ não verificado | `domain/mcp` | Verificar |

**Leitura**: o `AutoBoostRule` tem um `thresholdValue` único e um `ruleType` de enum
fechado (`ON_VIRAL_SCORE`, `ON_ENGAGEMENT_RATE`, `ON_MANUAL`). O playbook do §8.3 precisa
de condições compostas, baselines e ações de mutação — cabe como evolução do mesmo model,
não como reescrita, mas não dá para usar como está.

---
## 16. Riscos

- **Conteúdo genérico em escala.** Mitigação: templates derivados de referências que já
  performaram, gate de aprovação, brand kit rígido, e a camada determinística cuidando de
  todo texto e UI.
- **Custo generativo descontrolado.** Cache por hash, budget guard, preview em still
  antes do render completo.
- **Decidir cedo demais** (learning phase da Meta). Guardrails de impressão/spend/tempo.
- **Overfitting a um nicho.** Baselines por App/nicho, nunca globais.
- **Políticas de anúncio** (claims de saúde, fitness, finanças). Checagem de compliance
  no approval, antes de subir.

---

## 17. Código já escrito, à espera do projeto

Três peças foram implementadas e testadas durante o planejamento. Elas foram escritas
dentro do payposts e depois **removidas de lá** (o payposts está intocado), mas o código
está guardado e entra no `creativebuilder` assim que o esqueleto existir:

| Peça | O que faz | Estado |
|---|---|---|
| `IStorage` + `LocalStorage` + `S3Storage` | storage S3-compatível (R2/S3/MinIO): `saveStream`, `findByHash` (cache por conteúdo), `getSignedUrl` | testado por smoke test; nunca falou com bucket real |
| `HiggsfieldClient` | submit→poll, devolve `creditsUsed` e `expiresAt` de 7 dias | 7 testes unitários passando; formato de resposta é suposição documentada |
| `CreditBudgetGuard` | teto diário por app em créditos, reserva antes de gastar, rollback e refund | 6 testes unitários passando |

Ao portar, duas coisas mudam: o `LocalStorage` deixa de precisar manter a assinatura
antiga (foi preservada só por compatibilidade com o payposts), e o `findByHash` deve virar
lookup no model `CreativeAsset` em vez de listagem de bucket (§14.1).
