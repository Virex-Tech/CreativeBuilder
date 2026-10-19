# Catálogo de embalagens — OzemPro (os 100 formatos, filtrados)

> Fonte: PDF "100 formatos de anúncio pra testar no Meta" (Arthur Botelho), recebido em
> 18/10/2026. Decisões da equipe do mesmo dia já aplicadas: sem fundador em cena (23, 90), sem
> cupom (92), sem valor de mercado nem estatística pública (2, 61). Este arquivo é o PDF **passado pelo filtro do OzemPro**: contexto, compliance,
> roteiro-ugc, playbook de elementos e material disponível. Decisões da equipe em 18/10/2026:
> **todos os formatos entram como dimensão de teste, inclusive imagem estática e carrossel.**
>
> Ordem de precedência continua: `contexto.md` (compliance) > `roteiro-ugc.md` > este catálogo.
> O PDF chama de "formato" o que aqui se chama **embalagem**, para não confundir com os três
> formatos de produção da equipe (flash, narrado, viral).

## As cinco dimensões de um criativo

Um criativo é uma combinação. Cada eixo tem a sua fonte, e nenhum substitui o outro:

| Eixo | O que é | Onde está | Exemplo |
|---|---|---|---|
| **Dor** | o problema que o hook ataca | `masterlist-dores.md` (5 tiers) | erro no fracionamento (Tier 1) |
| **Hook** | como os 3 primeiros segundos fisgam | `roteiro-ugc.md`, "Os 4 hooks" e "Conexão / fator uau / polêmica" | polêmica: "ninguém me ensinou isso, nem a farmácia" |
| **Embalagem** | a cara do anúncio no feed | **este arquivo** (nº do PDF) | #7 pesquisa no Google |
| **Produção** | como o vídeo é montado | `roteiro-ugc.md`, "Os três formatos" + estático/carrossel (abaixo) | viral, 15 s |
| **Fonte de imagem** | de onde vem o que aparece | catálogos de material (abaixo) | Vitória v4 + mock de busca no Remotion |

O PDF diz, e vale aqui: **mesma dor, mesmo hook, mesma página, muda só a embalagem** quando o
teste é de embalagem. Mudar dois eixos ao mesmo tempo não ensina nada.

## Fontes de imagem e o que cada uma cobre

| Fonte | O que é | Catálogo | Serve para |
|---|---|---|---|
| **Pessoa real** | Maria, Vitória, Xanda (8 takes, quase todos mudos de 4 s) | `material-filmagens.md` | abertura de viral e narrado, prova visual; formatos de fala exigem gravação nova (`pauta-gravacao.md`) |
| **Panda** | 16 takes de animação, mudos | `material-panda.md` | embalagem #21 nativa; hook, dor, virada, CTA nos três formatos |
| **Tela do app** | 12 gravações + prints, por idioma | `material.md` | demo, recorte como elemento, foto do produto |
| **Elementos Remotion** | mocks de interface, cartões, régua, contador, lista com risco | `elementos-playbook.md` (seção "Moldes de interface") | quase todo formato "estático" do PDF vira cena de 2–4 s ou imagem |
| **Foto Pexels** | foto parada, licença livre | `elementos-playbook.md`, "Imagem como elemento" | fundo de outdoor, cena de rotina, foto de estúdio |
| **B-roll Higgsfield** | vídeo gerado, sem texto nem UI | `AGENTS.md`, "Alternativa: Higgsfield" | só cena que não existe no material (custo e ok antes) |
| **Voz** | Gemini TTS, Achernar e Orus | `tools/tts-gemini.mjs` | flash, narrado em off, estático não usa |

**Regra que não se quebra, lembrada aqui:** todo texto e toda interface (nota do iPhone, conversa
de WhatsApp, barra do Google, thread, caixinha, tela de chamada) é desenhada pelo Remotion. Nunca
por modelo generativo, nunca print real de terceiro sem autorização.

## Produção: os três formatos de vídeo, mais estático e carrossel

| Produção | Duração | Como sai do renderer | Onde está a regra |
|---|---|---|---|
| Flash | 30–40 s | `remotion render` | `roteiro-ugc.md` |
| Narrado | 28–43 s | `remotion render` | `roteiro-ugc.md` |
| Viral | 10–20 s | `remotion render` | `roteiro-ugc.md` |
| **Estático** | 1 imagem | spec de **uma cena** sem áudio, `remotion still --frame=<n>` no quadro em que todos os elementos já entraram; `format` 1080×1920 (Stories/Reels) ou 1080×1350 (feed 4:5) | seção "Estático e carrossel" do `roteiro-ugc.md` |
| **Carrossel** | 2–10 imagens | um spec por cartão (ou uma cena por cartão, um `still` por cena), todos na mesma `format` 1080×1350 ou 1080×1080 | idem |

`output.kind` aceita `image` e `carousel` no schema (`render/src/spec.ts`), mas o pipeline de
imagem é o `still`: não existe comando próprio ainda. Imagem estática **não leva legenda karaokê
nem locução**; leva os mesmos elementos, nas mesmas três faixas verticais.

## Como ler o catálogo

- **Veredito:** ✅ entra como está · ⚠️ entra com adaptação (descrita na coluna "Como fazer aqui")
  · ❌ fora, com o motivo. Fora não é "nunca": se a condição mudar (ex.: a equipe trouxer prova
  real e autorizada), o formato volta.
- **Produção:** E = estático · C = carrossel · F = flash · N = narrado · V = viral. O PDF marca o
  tipo original (ESTÁTICO / VÍDEO / CARROSSEL); aqui está traduzido para o nosso.
- **Fonte:** pessoa · panda · app · elementos · pexels · higgsfield · gravação nova.
- **Status:** nunca testado · em teste · validado · reprovado — atualizar pela ficha em
  `analise/criativos/`. Em 18/10/2026 tudo está **nunca testado**, exceto onde indicado.
- Toda frase de exemplo aqui é só direção de conteúdo. O texto final obedece ao `roteiro-ugc.md`:
  sem frase de efeito, sem presumir a condição de quem assiste, sem nome de medicamento, sem
  promessa de resultado.

---

## TOPO (1–35): parar quem nunca viu o app

Métrica da etapa (regras da equipe): **Hook Rate** e **Hold Rate**. Sinal de que não serviu: muita
impressão, ninguém para.

| # | Embalagem | Veredito | Produção | Fonte | Como fazer aqui | Status |
|---|---|---|---|---|---|---|
| 1 | Notícia urgente | ⚠️ | E, V | elementos | Mock de manchete de portal com **fato real e verificável do nicho** (ex.: escassez nas farmácias, Tier 1), fonte e data na tela. Nome do medicamento só por apelido, o que limita o fato a notícias que façam sentido com "canetinha". Nunca inventar notícia. | nunca testado |
| 2 | Manchete com estatística | ❌ | — | — | Decisão da equipe (18/10/2026): não usar número de fonte pública em anúncio. Sem prova própria, não há estatística a mostrar. | — |
| 3 | Avaliação de zero estrelas | ❌ | — | — | Simula uma avaliação que não existe: prova inventada (`contexto.md`, "Provas"). | — |
| 4 | Notas do iPhone | ✅ | E, V (abertura) | elementos | Mock do app Notas (`card` light + `text`; a digitação ao vivo ainda não existe no renderer, ver "Pedidos para o renderer" no playbook). Conteúdo: uma cena vivida (conexão), ex.: a conta de risquinhos feita no caderno. Sem design, sem logo até o CTA. | nunca testado |
| 5 | Conversa de WhatsApp | ✅ | E, V | elementos | Mock de conversa: pergunta de dor ("quantos risquinhos pra 2,5?") e resposta com a tela da calculadora. **Encenação declarada** (selo pequeno "simulação") ou conversa real com autorização por escrito. Nomes fictícios. | nunca testado |
| 6 | Print de e-mail | ⚠️ | E | elementos | Mock de caixa de entrada com assunto curioso. Público do app não vive no e-mail: prioridade baixa, testar depois dos outros mocks. | nunca testado |
| 7 | Pesquisa no Google | ✅ | E, V (abertura) | elementos | Mock da barra de busca com autocompletar listando dores da masterlist com apelido ("canetinha quantos risquinhos", "picadinha enjoo 48h"). Mostra que a dúvida é comum sem afirmar nada sobre quem assiste. | nunca testado |
| 8 | Estilo fórum / thread | ✅ | E, C | elementos | Mock de pergunta em grupo com 2–3 respostas, uma delas apontando a calculadora. Nomes e avatares fictícios; nunca post real sem autorização. Carrossel: 1 cartão por resposta. | nunca testado |
| 9 | Meme estático | ⚠️ | E | panda, elementos | Só com piada interna real do nicho (risquinhos, dia de picadinha, 5º dia e a fome volta). Template conhecido com o panda no lugar do personagem. Sem piada interna de verdade, não entra. | nunca testado |
| 10 | Caixinha do story | ✅ | E, V | elementos, pessoa | Mock da caixinha de pergunta do Instagram respondida. Pergunta = dor com apelido; resposta = tela do app. Em vídeo: pessoa ou panda "respondendo" (abertura 3–5 s). | nunca testado |
| 11 | Não compre isso | ⚠️ | E, V | elementos, pessoa | "Não baixa o OzemPro se…" **falando do app, não de quem assiste**: "…se quer app de dieta", "…se quer que alguém prescreva a dose". Filtra sem presumir condição. | nunca testado |
| 12 | Aviso / Atenção | ✅ | E, V (hook) | elementos | Faixa amarela (`card` variant warn) com o erro do nicho: "dose contada de cabeça", "tabela do WhatsApp". O erro é da prática, nunca de quem lê. Sfx `error.mp3`. | nunca testado |
| 13 | Provocação direta | ⚠️ | V (N, F) | pessoa, panda | Tom de bronca **apontado para fora** (farmácia, bula, tabela de WhatsApp), que é a "polêmica" do `roteiro-ugc.md`. Proibido apontar para quem assiste (atributos pessoais). | nunca testado |
| 14 | Em caso de emergência | ✅ | E, V | elementos, app | Caixa "quebre o vidro" com o ícone do app dentro. Dor: dúvida de dose na hora de aplicar, madrugada, sem ninguém para perguntar. Sfx `click_hook.mp3`. | nunca testado |
| 15 | X sinais de que… | ⚠️ | C, V | elementos | Impessoal: "5 sinais de que a dose está sendo contada no olho", nunca "5 sinais de que **você**…". Cada sinal uma cena/cartão; o 5º leva à calculadora. | nunca testado |
| 16 | Mito contra fato | ⚠️ | C, E, V | elementos | Comparação lado a lado (playbook 4.20). Mito e fato **sobre a rotina e sobre o app** ("mito: dá pra contar de cabeça"), nunca afirmação médica sobre o remédio ou sobre efeito no corpo. | nunca testado |
| 17 | Rabisco | ✅ | E, V | elementos | Desenho à mão explicando a seringa: `syringe_ruler` + `scribble` (seta, sublinhado, colchete; **círculo está reprovado**). Fundo off-white tipo guardanapo. | nunca testado |
| 18 | Quadro branco | ⚠️ | N | gravação nova | Pessoa explicando a conta da dose num quadro, 10–15 s, e o quadro "vira" a calculadora. Exige gravação (ver `pauta-gravacao.md`). | nunca testado |
| 19 | Texto na pele | ⚠️ | E, V (hook) | gravação nova | Post-it ou frase na mão com apelido da dor. Exige gravação. Prioridade baixa: estranho o bastante para parar, mas sem ligação com o app até o corte. | nunca testado |
| 20 | Tela verde | ✅ | N, V | gravação nova ou panda + elementos | Pessoa (ou panda) na frente de um **mock** de comentário, manchete ou tabela reagindo. O print atrás é desenhado pelo Remotion, nunca print real sem autorização. | nunca testado |
| 21 | Massinha / animação | ✅ | F, N, V | panda | **É o panda.** Os três formatos com takes do panda já são esta embalagem. Lembrar: panda nunca fala em primeira pessoa. | **em uso** (criativos com panda) |
| 22 | Corte de podcast | ⚠️ | N | gravação nova | Dois microfones, uma pessoa conta a dor e a outra responde com o app. Exige gravação com duas pessoas; versão panda (dois pandas no estúdio) é b-roll a gerar. | nunca testado |
| 23 | Fundador falando | ❌ | — | — | Decisão da equipe (18/10/2026): ninguém da equipe aparece como fundador. | — |
| 24 | Bastidores | ⚠️ | N, V | gravação nova, app | "Como a calculadora é feita": tela do app sendo testada, caderno de dores, a equipe. Só se a equipe quiser aparecer. Prioridade baixa. | nunca testado |
| 25 | Antes e depois | ❌ | — | — | Tom de voz do app ("não é antes e depois") e política da Meta para saúde/emagrecimento. Inclui o take da Maria com a saia larga **como antes/depois**; o take continua liberado como abertura de dor/prova de rotina, não como comparação de corpo. | — |
| 26 | Referência pública | ⚠️ | N, V | pessoa, panda, elementos | Comentar uma notícia ou fala pública sobre o tema (manchete em mock). Nunca imagem nem nome de celebridade; a referência é o fato, não a pessoa. | nunca testado |
| 27 | Mockup de outdoor | ✅ | E | pexels, elementos | Foto de outdoor/ponto de ônibus do Pexels, nosso texto aplicado em perspectiva (`image` + `text`). Dá cara de marca grande. Texto curto, com apelido. | nunca testado |
| 28 | Anúncio de evento | ❌ | — | — | Não há evento, aula ao vivo nem lançamento. Volta se houver. | — |
| 29 | Ligação do fundador | ✅ | E, V (5 s) | elementos | Mock de tela de chamada recebida: "Pandinha do OzemPro" ou nome da marca. Curiosidade pura; em vídeo, 5 s e corta para o app. Sfx de toque (a gerar/adicionar em `sfx/`). | nunca testado |
| 30 | Diagrama de Venn | ✅ | E | elementos | Dois círculos ("o que quero registrar" e "o que o médico pergunta") com o app no meio. Explica posicionamento em uma imagem. | nunca testado |
| 31 | Tier list | ⚠️ | V, E | elementos | Ranking S–D dos **jeitos de contar a dose** (regra de 3 de cabeça, tabela do WhatsApp, caderno, calculadora). **Nunca** ranquear medicamentos, marcas ou tratamentos. | nunca testado |
| 32 | Entrevista na rua | ⚠️ | N | gravação nova | Pergunta rápida na rua ("quantos risquinhos pra 2,5 mg?"). Exige gravação externa e autorização de imagem de cada pessoa. Caro de produzir: só se a equipe quiser. | nunca testado |
| 33 | Truque rápido | ✅ | V, F | app, pessoa/panda | "Em 10 segundos: quantos risquinhos puxar" → calculadora. É o viral de risquinhos com o hook de fator uau. Entrega valor antes do CTA. | nunca testado (próximo do 105/112) |
| 34 | Efeito colateral | ❌ | — | — | Brinca com o formato de bula em nicho de saúde; o próprio PDF alerta. Risco de reprovação e de leitura errada (efeito colateral é dor real Tier 2 do público). | — |
| 35 | Reação a comentário | ✅ | N, V | pessoa/panda + elementos | Comentário real dos **nossos** anúncios (nome e foto cobertos) em mock, e a pessoa ou o panda responde. Puxa a discussão. Comentário de terceiro só com autorização. | nunca testado |

**Regra do topo (PDF, vale aqui):** se precisa de legenda para fazer sentido, não serve para o frio.
A imagem ou os 3 primeiros segundos se explicam sozinhos.

---

## MEIO (36–70): explicar, provar, derrubar objeção

Métrica da etapa: **CTR** (taxa de cliques no link). Sinal de que não serviu: clica, mas não instala.

| # | Embalagem | Veredito | Produção | Fonte | Como fazer aqui | Status |
|---|---|---|---|---|---|---|
| 36 | X motivos | ✅ | C, E | elementos, app | "5 motivos" = 5 funcionalidades da lista de 21 (`contexto.md`), um cartão cada, com recorte da tela. A calculadora é sempre um deles. | nunca testado |
| 37 | Nós contra eles | ⚠️ | E, V | elementos | Comparação lado a lado: "app de dieta" × OzemPro (registra dose, local, estoque, calcula risquinhos). Sem citar concorrente pelo nome. | nunca testado |
| 38 | Nós contra nós | ⚠️ | E | elementos, app | "O que mudou" entre versões do app. Só quando houver atualização visível para mostrar; reativa quem já conhece. Prioridade baixa. | nunca testado |
| 39 | Jeito antigo contra novo | ✅ | V, F, E | pessoa/panda, app, elementos | **Regra de 3 no caderno × calculadora.** Metade antiga (caderno, tabela do WhatsApp, `list_card` com risco), metade nova (tela do app). Um dos mais fortes para o ângulo campeão. | nunca testado |
| 40 | Problema contra solução | ✅ | E, V | elementos, app | Metade da arte com a dor (impessoal), metade com a tela que resolve. Funciona em qualquer dor da masterlist. | nunca testado |
| 41 | Problemas riscados | ✅ | E, V | elementos | `list_card` com tachado ao vivo (playbook 4.9/4.13): "contar de cabeça", "perder a conta do local", "esquecer o dia". Já construído uma vez. | nunca testado como embalagem principal |
| 42 | Carta de término | ✅ | E, V | elementos | Nota do iPhone em tom de término com o jeito antigo: "caderno, acabou". **Cuidado:** o texto precisa de detalhe vivido (conexão), não de bordão; frase de efeito é proibida. | nunca testado |
| 43 | Como fazer | ✅ | C, V | app, elementos | Passo a passo da calculadora (frasco → dose → seringa → resultado), um cartão ou cena por passo. Entrega valor e mostra que a parte difícil o app faz. | nunca testado |
| 44 | Educativo | ⚠️ | C, F | elementos, app | Ensinar um conceito que precisa ser entendido antes de usar: "o que é UI na seringa", "o que é rodízio de local". **Descreve o que o app faz; não orienta tratamento** (o app não prescreve). | nunca testado |
| 45 | Especialista explicando | ⚠️ | N | gravação nova | Só com profissional real, registro no conselho e regras de publicidade do conselho. Não há hoje. Entra quando a equipe trouxer o profissional. | pendente de pessoa |
| 46 | Perguntas frequentes | ✅ | C, V | elementos, app | As dúvidas que mais chegam (comunidade, suporte, comentários dos anúncios), cada uma respondida com uma tela. Fonte real, não inventada. | nunca testado |
| 47 | Resposta a comentário | ✅ | E, V | elementos, app | Versão estática do #35: mock do comentário real (coberto) + resposta em arte com a tela. | nunca testado |
| 48 | Estudo de caso | ❌ | — | — | Exige cliente com nome e autorização, e resultado: não há prova (`contexto.md`). | — |
| 49 | Selos e registros | ❌ | — | — | Não há selo, certificação nem registro a mostrar; o app não é dispositivo médico. | — |
| 50 | Colagem de prova social | ❌ | — | — | Não há avaliações, mensagens ou marcações autorizadas. Volta quando houver. | — |
| 51 | Avaliação do Google | ❌ | — | — | Equivalente seria a nota da loja: não há dado disponível e autorizado. | — |
| 52 | Nota no Reclame Aqui | ❌ | — | — | Não se aplica a app; não há nota. | — |
| 53 | Estático com muito texto | ✅ | E | elementos | Carta longa numa imagem, tipo post-it gigante, em **primeira pessoa de pessoa real** ou impessoal. Toda a carta em conexão (detalhe miúdo), zero frase de efeito. Quem lê até o fim já está convencido. | nunca testado |
| 54 | Transformação | ❌ | — | — | Jornada de cliente com resultado corporal: promessa de resultado + ausência de prova autorizada. | — |
| 55 | Depoimento em vídeo | ❌ | — | — | "Cliente falando do resultado": não há depoimento autorizado, e resultado é promessa. A pessoa real contando a **dor** em 1ª pessoa não é depoimento: é o formato narrado, já liberado. | — |
| 56 | Demonstração | ✅ | N, V | app | A calculadora funcionando **sem corte**, do frasco ao resultado, em mockup. Responde "mas funciona mesmo?". A gravação já existe. | **em uso** (narrado/viral) |
| 57 | Unboxing | ⚠️ | V, N | app (gravação nova) | "Abrindo o app pela primeira vez": onboarding até a primeira dose cadastrada. **Não há gravação de onboarding** (`material.md`, pontas soltas). Entra quando gravarem. | pendente de material |
| 58 | Tabela comparativa | ⚠️ | E, C | elementos | **Nunca planos nem preço** (`contexto.md`). Adaptar: tabela dos jeitos de calcular (cabeça × tabela × calculadora) ou das abas do app. Sobrepõe #37/#39: testar um só. | nunca testado |
| 59 | Dia na vida | ✅ | N, F | gravação nova ou panda, app | Rotina com o app: acorda, registra água, foto do almoço, lembrete da dose, aplica, registra local. Com panda vira flash em 3ª pessoa. | nunca testado |
| 60 | Objeção respondida | ✅ | N, V, E | pessoa/panda, app | Objeção real de quem não baixa: "mais um app pra preencher?", "é só uma calculadora?", "e se eu errar mesmo assim?". Responde de frente, com a tela. Sem preço. | nunca testado |
| 61 | Simulação de custo | ❌ | — | — | Decisão da equipe (18/10/2026): nenhum valor de mercado na tela. A dor do custo (Tier 1) continua, mas sem conta nem número. | — |
| 62 | Roteiro na tela | ✅ | V | app, pessoa | **É o viral.** Só texto e tela, sem rosto obrigatório. Rápido de produzir em escala para testar ângulos. | **em uso** |
| 63 | Pedimos desculpas | ❌ | — | — | Mostraria demanda (fila, esgotado) que não há como provar: prova inventada. | — |
| 64 | Linha do tempo | ❌ | — | — | Não há história de marca com marcos a mostrar. | — |
| 65 | Tour pelo espaço | ⚠️ | F | app | "Tour pelo app": todas as abas em sequência, 1–2 s cada. É o ângulo "tudo num lugar só" do `contexto.md`. Tira o medo de abrir pela primeira vez. | nunca testado |
| 66 | Entrevista com cliente | ❌ | — | — | Depoimento de cliente: sem autorização e sem prova. | — |
| 67 | Pra quem é / pra quem não é | ⚠️ | E, C | elementos | Duas colunas **sobre o que o app faz**: "é pra registrar dose, local e estoque" / "não é app de dieta, não prescreve". Nunca descrever quem assiste (peso, tratamento, sintoma). Revisar com a seção "Atributos pessoais" antes de subir. | nunca testado |
| 68 | Print de resultado | ❌ | — | — | Painel/relatório com resultado de cliente: não há, e seria resultado corporal. O **recorte da tela do app** (ex.: "puxe até 25 UI") não é isto: é demo, já liberada. | — |
| 69 | Quiz | ⚠️ | C, V | elementos, app | Quiz de **conhecimento**, não de perfil: "2,5 mg num frasco de 10 mg: quantos risquinhos?" → resposta na calculadora. "Qual é o seu tipo de…" presume condição e está fora. | nunca testado |
| 70 | Processo em etapas | ✅ | C, V | app, elementos | Como funciona: baixa → cadastra a caneta → calcula → recebe o lembrete → registra o local. Reduz a ansiedade de quem nunca usou. | nunca testado |

**Regra do meio (PDF, vale aqui):** a melhor fonte de embalagem de meio é o que a comunidade e o
suporte ouvem todo dia. Cada pergunta repetida é um #46, #60 ou #43 esperando para ser feito.

---

## FUNDO (71–100): dar o motivo para decidir agora

Métrica da etapa: **custo por paywall install, custo por compra, ROAS** (regras da equipe). Sinal
de que não serviu: gasta no público quente e não converte.

A maior parte do fundo do PDF é **oferta, preço, escassez e prova**, e o `contexto.md` proíbe
preço e comparação de planos, não há escassez real e não há prova. Por isso o fundo é a etapa com
menos embalagens. O que sobra é forte: foto do produto (criativo 95, validado) e garantia real.

| # | Embalagem | Veredito | Produção | Fonte | Como fazer aqui | Status |
|---|---|---|---|---|---|---|
| 71 | Oferta primeiro | ❌ | — | — | Preço e condição na tela: proibido (`contexto.md`, "Oferta"). | — |
| 72 | Kit / combo | ❌ | — | — | Não há produtos a combinar; envolve preço. | — |
| 73 | Estoque baixo | ❌ | — | — | App não tem estoque; seria mentira. | — |
| 74 | Contagem regressiva | ❌ | — | — | Não há prazo real. Contagem que reinicia vira reclamação. | — |
| 75 | Mockup de checkout | ❌ | — | — | Tela de pagamento = paywall e preço na tela. | — |
| 76 | Comparação de preço | ❌ | — | — | Preço. | — |
| 77 | Foto do produto | ✅ | E | app, elementos | **Celular com o app + ícone + uma frase**, fundo limpo. É o criativo 95 (validado, ROAS 2,27): "o app das canetinhas que virou febre". Sem preço. Melhor ponto de partida do estático. | **validado** (95) |
| 78 | Foto de estúdio | ⚠️ | E | app, pexels | O mesmo #77 com fundo e luz de estúdio (foto Pexels de bancada/mesa, mockup roxo). Para passar valor sem falar de preço. | nunca testado |
| 79 | Depoimento UGC | ⚠️ | N | pessoa | "Criador falando do produto como story": é o **narrado** com pessoa real, falando da dor e do que o app faz, nunca de resultado no corpo. Já liberado. | **em uso** (narrado) |
| 80 | Brinde | ❌ | — | — | Não há brinde; envolve oferta. | — |
| 81 | Garantia em destaque | ✅ | E, V (CTA) | elementos | A única garantia real: **"Cancele quando quiser"** (frase do paywall, `contexto.md`). Vira manchete do CTA. Nada além dessa frase. | nunca testado |
| 82 | Agenda quase cheia | ❌ | — | — | Não há agenda. | — |
| 83 | Esqueceu algo? | ⚠️ | E | app, elementos | Remarketing para quem **instalou e não usou**: "a caneta ainda não foi cadastrada" sobre a tela do estoque. Fala da ação no app, não da pessoa. Só para público de remarketing, fora da Fase Zero. | nunca testado |
| 84 | Depoimento + oferta | ❌ | — | — | Depoimento inexistente + oferta. | — |
| 85 | Pix com desconto | ❌ | — | — | Preço e condição. | — |
| 86 | Frete grátis | ❌ | — | — | Não se aplica. | — |
| 87 | Pilha de valor | ⚠️ | C, F | app, elementos | Tudo que vem no app listado item a item (os 21 recursos), **sem preço no fim**: termina no CTA. Em flash, é o "tudo num lugar só" com `list_card` que enche. | nunca testado |
| 88 | Última objeção | ✅ | N, V, E | pessoa/panda, app | "E se eu errar mesmo com o app?" → tabela do frasco com botão Compartilhar (gravação da calculadora, 0:12–0:15). Responde a dúvida de quem chegou até o fim. | nunca testado |
| 89 | Último dia | ❌ | — | — | Não há prazo. | — |
| 90 | Convite do fundador | ❌ | — | — | Decisão da equipe (18/10/2026): sem fundador em cena. | — |
| 91 | Print de fechamento | ❌ | — | — | Conversa de cliente fechando: não há, e seria prova. | — |
| 92 | Cupom de primeira compra | ❌ | — | — | Decisão da equipe (18/10/2026): cupom não entra, nem sem valor na tela. | — |
| 93 | Catálogo | ❌ | — | — | Não há catálogo de produtos. | — |
| 94 | Lembrete de evento | ❌ | — | — | Não há evento. | — |
| 95 | O preço, direto | ❌ | — | — | Preço. | — |
| 96 | Ainda pensando? | ✅ | E | app, elementos | Remarketing de quem clicou e não instalou: uma frase curta sobre a tela da calculadora e o mesmo botão. Sem presumir nada da pessoa. | nunca testado |
| 97 | Escolha seu plano | ❌ | — | — | Comparação de planos: proibida. | — |
| 98 | Prova de envio | ❌ | — | — | Não se aplica. | — |
| 99 | Resultado do cliente + CTA | ❌ | — | — | Resultado de cliente: sem prova, e resultado corporal é promessa. | — |
| 100 | Oferta da volta | ❌ | — | — | Oferta para ex-cliente: preço/condição. Remarketing sem oferta já é o #96. | — |

---

## Resumo: o que entra e o que fica de fora

| Etapa | Entram (✅ + ⚠️) | Fora (❌) |
|---|---|---|
| Topo | 29 | 6 (2, 3, 23, 25, 28, 34) |
| Meio | 23 | 12 (48–52, 54, 55, 61, 63, 64, 66, 68) |
| Fundo | 8 | 22 |
| **Total** | **60** | **40** |

**Por que ficam de fora, em cinco motivos** (cada um volta quando a condição mudar):

1. **Sem prova real e autorizada** (contexto: "Nunca invente provas"): 3, 48, 49, 50, 51, 52, 54,
   55, 63, 66, 68, 84, 91, 99.
2. **Preço, plano, oferta ou valor na tela** (contexto: "nunca citar valor nem comparar planos";
   equipe 18/10: nem cupom, nem conta de custo, nem estatística de fonte pública): 2, 61, 71,
   72, 75, 76, 80, 85, 86, 92, 95, 97, 100.
3. **Escassez, prazo ou evento que não existem**: 28, 73, 74, 82, 89, 93, 94, 98.
4. **Tom de voz e política de saúde da Meta**: 25 (antes e depois), 34 (bula como piada), 64 (sem
   história a contar).
5. **Ninguém da equipe em cena como fundador** (equipe, 18/10/2026): 23, 90.

## Os 12 para começar (sugestão de prioridade, não decisão)

Critério: já tem material, bate no ângulo campeão (risquinhos → calculadora) e é bem diferente do
que está rodando. Três por lote, um lote por etapa fraca:

| Lote | Etapa | Embalagens | Por quê |
|---|---|---|---|
| 1 | Topo | #7 Google · #4 Notas · #12 Aviso | três mocks de interface, zero gravação, muito diferentes entre si |
| 2 | Topo | #14 Emergência · #29 Ligação · #33 Truque rápido | curiosidade pura × valor imediato |
| 3 | Meio | #39 Antigo × novo · #41 Riscados · #60 Objeção | derrubam a objeção "eu já sei contar" |
| 4 | Fundo/estático | #77 Foto do produto (variar) · #81 Garantia · #96 Ainda pensando | estático barato, 95 já validou o #77 |

Os que **exigem gravação nova** (18, 20, 22, 32, 45, 57, 59) estão na
`pauta-gravacao.md`; entram quando o material chegar.

## Como testar (o método do PDF dentro das regras da equipe)

As regras de orçamento, kill-switch, validação e escala são **só** as de
`analise/regras-meta-ads.md`. O PDF entra por baixo delas, na escolha do que subir:

1. **Achar a etapa fraca** pela tabela da equipe: Hook/Hold baixos = topo; CTR baixo = meio;
   paywall install caro ou ROAS < 2 = fundo.
2. **Três embalagens bem diferentes** daquela etapa, uma campanha 1-1-1 cada (Fase Zero), subindo
   à meia-noite.
3. **Travar o resto:** mesma dor, mesmo hook, mesma produção, mesma página, mesmo público. Só a
   embalagem muda.
4. **Julgar pela métrica da etapa**, não só pelo CPA, mas o kill-switch (R$ 30 fraco, R$ 10 por
   paywall install) corta antes como sempre.
5. **Vencedor vira família:** achou a embalagem, varia hook e dor **dentro dela** (as mutações
   `hook_rewrite`, `hook_visual` etc. do `spec-tool variant`).
6. **Anotar formato, dor e hook de cada anúncio** na ficha (`analise/criativos/_modelo-ficha.md`,
   seção "Etiquetas") e no nome do anúncio. Sem etiqueta, o teste não aprende.

## Nome do anúncio

Para a análise agrupar por embalagem além do número do criativo, o nome do anúncio no Gerenciador
leva as etiquetas depois do número:

```
<nº> <mercado> · E<embalagem> · D<tier>-<dor curta> · H<hook> · <produção>
ex.: 121 Brasil · E07 · D1-risquinhos · Hpolemica · viral
```

O número continua sendo a chave (regra de agrupamento do `regras-meta-ads.md`); as etiquetas são
leitura. Hooks: `conexao` · `uau` · `polemica` (os três do `roteiro-ugc.md`).

## Checklist antes de subir qualquer embalagem (PDF + nossas regras)

- [ ] A embalagem é diferente do que já está rodando, não só a cor.
- [ ] Todo print, conversa, comentário e manchete é mock nosso ou real **com autorização**; nome e
      foto de terceiro cobertos; encenação declarada quando é encenação.
- [ ] Nenhuma frase afirma nada sobre quem assiste (peso, tratamento, sintoma, dose).
- [ ] Nenhuma promessa de resultado; nome de medicamento só por apelido; sem preço nem plano.
- [ ] Sem frase de efeito. Conexão, fator uau ou polêmica.
- [ ] A calculadora aparece (exceto recriação exata de referência).
- [ ] Etiquetas (embalagem, dor, hook, produção) no nome do anúncio e na ficha.
- [ ] `spec-tool check` e `review.mjs` passaram; estático: o `still` foi olhado.
