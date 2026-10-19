# Pauta de gravação — OzemPro

> Criada em 18/10/2026. Ordem de precedência: `contexto.md` (compliance) > `roteiro-ugc.md` >
> `formatos.md` > este arquivo. O que existe hoje está em `material-filmagens.md`,
> `material-panda.md` e `material.md`; aqui está só o que **falta**.

## Por que esta pauta existe

O catálogo de embalagens (`formatos.md`) tem 9 formatos que só saem com gravação nova (#18, 19, 20,
22, 24, 32, 45, 57, 59) e vários outros que ficam bem melhores com fala (#10, 11, 13, 33,
35, 39, 60, 88). O material de pessoa real que existe é quase todo take mudo de 4 s; só a Maria tem
fala, e uma fala só. Sem take falado não há narrado, não há tela verde, não há resposta de objeção.

Cada sessão abaixo foi desenhada para render **vários formatos** com uma gravação só: o mesmo take
de fala vira narrado (#79), reação a comentário (#35), objeção (#60) ou abertura de viral, só
trocando o que o Remotion desenha em volta. Por isso a pauta é por pessoa, não por embalagem.

## Regras de gravação (valem para todo take)

- **Formato:** 9:16 vertical, 1080x1920, 30 fps, H.264. iPhone: desligar HDR e gravar em "Mais
  compatível" (não HEVC). Se vier HEVC/HDR, `node tools/takes.mjs preparar` converte, mas HDR
  convertido sai com cor lavada: melhor evitar.
- **Câmera apoiada ou em tripé.** Câmera na mão só nos takes mudos de reação (3–5 s) que pedem
  selfie. Lente na altura dos olhos.
- **Luz de janela**, de frente ou de lado, nunca contraluz (a janela estourada atrás da Xanda no
  v2 é o erro a não repetir). Lapela se tiver; senão o celular a 1 m, sem ventilador nem geladeira
  ligada fazendo barulho.
- **Cada frase gravada 2 vezes.** Fica a melhor (regra do Fluxo 5 do `AGENTS.md`).
- **Pausa de 1 s entre frases**, boca fechada, olhando para a lente. É nela que o corte entra.
- **Olhar para a lente**, exceto nos takes marcados como reação (olhando para o lado, para o
  celular ou para o ponto onde o Remotion vai pôr o mock).
- **Nada de terceiro no quadro:** sem marca, sem personagem licenciado (o tapete Hello Kitty do
  maria-v1), sem logo de eletrodoméstico em destaque, sem rosto de outra pessoa.
- **Nome de medicamento nunca falado**, só apelido: moun moun, moun, tirze, canetinha, caneta,
  picadinha.
- **Rótulo de frasco, caixa e caneta virado para fora do quadro** (ou coberto com fita lisa). Nada
  legível. Aliás, o rótulo legível do xanda-v1 é pendência do material atual.
- **Não presumir nada sobre quem assiste.** A pessoa fala da vida **dela**, em 1ª pessoa, nunca
  "você que está travado", "seu tratamento", "seu peso". Dor da pessoa, não do espectador.
- **Sem frase de efeito.** Nada de slogan, antítese, moral no fim. A direção de cada take diz
  **sobre o que** falar; as palavras são dela, com número, gesto e a dúvida que sobra (conexão), ou
  um dado concreto que apareceu na tela (fator uau), ou uma acusação que aponta para fora: farmácia,
  bula, tabela de WhatsApp (polêmica).
- **Sem promessa:** ninguém fala de resultado no corpo, de quilo, de prazo. Fala do que o app faz.
- **Não gravar aplicação na pele nova.** Barriga à mostra com seringa já é cautela de compliance
  nos v2 e v5 da Vitória (política de anúncios da Meta). Esta pauta não pede mais gravação disso.
- **Autorização de imagem por escrito** de cada pessoa que aparece (inclusive voz), antes de gravar.
- **Nome do arquivo:** `<pessoa>-v<n>.mp4` seguindo a numeração que já existe (vitoria-v6 em
  diante, xanda-v3, maria-v2), e a lista do que há em cada um vai para `material-filmagens.md`
  depois (`takes.mjs preparar` mostra a fala com tempo de cada palavra).

Legenda das colunas: **Serve para** = função na estrutura (hook · dor · virada · objeção · CTA).
**Dur.** = duração alvo do trecho útil; grave 2–3 s a mais no começo e no fim.

---

## Pauta por pessoa

### Vitória — cozinha, seringa e frasco (12 takes)

Já existe: cozinha de armários de madeira e geladeira inox, frasco, seringa com tampa laranja,
lapela, camiseta branca (v4–v5) e moletom bege (v1–v3). Camiseta branca é a roupa da sessão nova
(v4 tem o melhor enquadramento para texto). Plano médio, câmera fixa, **topo do quadro livre** para
texto. Foco: risquinhos (ângulo campeão), preparo da dose, objeção, truque rápido, tela verde.

**Rende:** narrado (#79, #62 variantes), viral com texto, #33 truque rápido, #39 antigo × novo, #60
e #88 objeções, #13 polêmica, #20 tela verde e #35 reação a comentário, #47 estático com a resposta,
#43 como fazer, #17 rabisco (o close do take V2 serve de base para a régua desenhada).

| Take | Embalagem (nº) | Enquadramento | Dur. | O que faz / diz (direção, não texto decorado) | Serve para |
|---|---|---|---|---|---|
| V1 | 33, 79, 62 | plano médio, câmera fixa, olhando a lente | 8–12 s | Conta **uma cena vivida** com a seringa na mão: quantas vezes contava os risquinhos antes de aplicar e o que sobrava de dúvida no fim. Número, gesto, nada de moral. 1ª pessoa. | hook (conexão), dor |
| V2 | 17, 33, 43 | plano fechado das mãos + rosto ao fundo | 8–10 s | Segura a seringa de frente para a lente, aponta com o dedo os traços e conta em voz alta onde ficava a dúvida entre um traço e outro. Sem dizer dose recomendada: só descreve o que ela via. | dor, hook (visual) |
| V3 | 13, 79 | plano médio | 6–8 s | Polêmica apontando para fora: ninguém explicou a conta dos risquinhos, nem a bula, nem a farmácia, e o que ela fez para resolver. Sem acusar quem assiste. | hook (polêmica) |
| V4 | 60 | plano médio | 8–10 s | Responde "mais um app pra preencher?" **de frente**: o que realmente precisa digitar para a calculadora responder (frasco, dose, seringa) e que o resto ela usa quando quer. Diz só o que o app faz. | objeção |
| V5 | 88 | plano médio | 8 s | Responde "e se eu errar mesmo com o app?": diz que confere a tabela do frasco e o que faz com a tabela (compartilha, tira print). Sem prometer que o app evita erro. | objeção, CTA |
| V6 | 33, 56 | plano médio, olha para baixo e para a lente | 10–12 s | "O que apareceu na tela": descreve o número que a calculadora mostrou e onde ele cai na seringa (fator uau, dado real do app, o mesmo que a gravação mostra). O Remotion corta para a tela depois. | virada, hook (uau) |
| V7 | 20, 35, 47 | plano médio, **parede lisa** atrás dela, corpo no terço esquerdo, terço direito livre | 10 s | Reage a um comentário (que o Remotion desenha à direita): lê com a cabeça virada, depois responde olhando para a lente. Grave **três reações-comentário** diferentes (dúvida, discordância, "essa é boa"), sem dizer o que o comentário diz: a resposta é só dela. | virada, objeção |
| V8 | 59, 62 | plano médio, mudo | 5 s | Mudo. **Alívio ao ler a tela:** olha o celular, a expressão relaxa, respira, olha para a lente. | virada |
| V9 | 13, 33 | plano fechado, mudo | 4 s | Mudo. **Dúvida olhando a seringa:** levanta contra a luz da janela, inclina a cabeça, franze a testa, volta a olhar. | dor, hook (visual) |
| V10 | 20, 57, 62 | plano médio, mudo | 4 s | Mudo. **Mostra o celular com a tela virada para a câmera** (tela apagada ou papel de parede liso, nada legível, para o mockup entrar por cima), gira o celular um pouco e sorri. | virada, CTA |
| V11 | 39, 41 | plano fechado do caderno na bancada, mudo | 5 s | Mudo. Caderno com a conta de cabeça: escreve, risca, escreve de novo, passa a mão no rosto. Caderno com números ilegíveis. Base do #39 antigo × novo e do #41. | dor |
| V12 | 43, 59 | plano médio das mãos, mudo | 5 s | Mudo. **Preparo da dose sem pressa**, frasco com o rótulo virado para dentro, enche a seringa e confere à luz. Versão calma do v3 existente, sem sorriso para a câmera. | demo, fundo |

### Xanda — luz quente e estética orgânica (12 takes)

Já existe: apartamento de parede terracota e parede branca, lustre, luz quente de fim de tarde,
seringa e frasco (rótulo legível no v1), selfie instável (v1) e plano apoiado (v2). **Apoiar o
celular** nos takes falados (a instabilidade do v1 só funciona em 1–2 s). Foco: caixinha do story,
reação a comentário, "não baixa se…", rodízio de local.

**Rende:** #10 caixinha, #11 "não baixa se…", #35 e #47 reação a comentário, #20 tela verde, #13
polêmica, #44 educativo (rodízio), #46 FAQ, narrado (#79) e viral de abertura.

| Take | Embalagem (nº) | Enquadramento | Dur. | O que faz / diz (direção, não texto decorado) | Serve para |
|---|---|---|---|---|---|
| X1 | 10, 79 | selfie apoiada, cabeça ao peito, **terço superior livre** | 10 s | Responde a uma pergunta de caixinha (o Remotion desenha a pergunta no topo): conta o que ela mesma fazia, com detalhe miúdo, e o que mudou na rotina. 1ª pessoa. Grave **duas perguntas diferentes** sobre a mesma dor, por exemplo "conta de risquinhos" e "esquecer onde aplicou da última vez". | hook (conexão), objeção |
| X2 | 35, 47, 20 | apoiada, parede terracota atrás, cabeça virada para um ponto fora do quadro | 10 s | Reage a um comentário nosso: lê (olhando para o lado), respira e responde olhando a lente. Sem repetir o comentário. | objeção, virada |
| X3 | 11 | plano médio, apoiada | 4–5 s | "Não baixa o OzemPro se…" **falando do app, não de quem assiste**: o que o app não é (não é app de dieta, não prescreve dose). Grave **três finais diferentes**, um por take de 4 s. | hook (polêmica) |
| X4 | 13, 79 | plano médio | 6–8 s | Polêmica para fora: como era a dúvida de aplicar sozinha e o que ninguém mostra (nem a bula, nem o balcão). Sem apontar para quem assiste. | hook (polêmica) |
| X5 | 79, 44 | plano médio, mãos visíveis | 8–10 s | Esquecer onde aplicou da última vez: conta uma situação vivida (a data que não lembrava, a dúvida) e que hoje registra o local no app. Descreve o que o app faz. | dor, virada |
| X6 | 79 | selfie apoiada, luz quente | 8 s | Narrado curto: dor em 1ª pessoa até o ponto de virada ("foi aí que baixei…"). Termina olhando para o lado, **sem voltar** depois do corte (regra do narrado). | hook, virada |
| X7 | 46 | plano médio | 8 s | Responde uma dúvida que aparece nos comentários dos anúncios e na comunidade (a equipe escolhe a dúvida real; não inventar). Diz o que o app mostra em resposta. | objeção |
| X8 | 59, 62 | selfie apoiada, mudo | 4 s | Mudo. **Alívio ao ler a tela:** olha o celular, ombros descem, sorriso discreto, luz quente no rosto. | virada |
| X9 | 13, 33 | plano fechado, mudo | 4 s | Mudo. **Dúvida olhando a seringa:** levanta, olha de lado, inclina a cabeça, olha a lente. Rótulo do frasco fora do quadro. | dor, hook (visual) |
| X10 | 20, 57 | plano médio, mudo | 3–4 s | Mudo. **Mostra o celular com a tela virada para a câmera**, apagada ou com papel de parede liso. | virada, CTA |
| X11 | 20, 35 | plano médio, **parede terracota lisa** atrás, mudo | 4 s | Mudo. Três reações de 4 s para tela verde: surpresa (sobrancelha), "calma aí" (mão levantada), discordância (cabeça). | reação |
| X12 | 59, 43 | plano médio das mãos, mudo | 5 s | Mudo. Ritual de preparo com algodão e frasco **na bancada** (versão calma e apoiada do v2), sem barriga à mostra. | demo, fundo |

### Maria — dia na vida e prova de rotina (11 takes)

Já existe: maria-v1 (10 s, corpo inteiro, parede clara com espelho de arco, luz de janela) com fala
real e uma ideia só. A nova sessão muda de **fundo e de quadro**: sem tapete Hello Kitty, plano
médio (cintura para cima), câmera na altura dos olhos. Foco: dia na vida (#59), última objeção
(#88), carta falada (#53, #42). **Não gravar comparação de corpo** (#25 está fora): a fala da
Maria é sobre rotina e dúvida, nunca sobre o corpo.

**Rende:** #59 dia na vida (narrado), #79 narrado, #53 carta, #42 carta de término, #88 última
objeção, #60 objeção, #13 polêmica, #14 emergência (abertura), viral de abertura. O maria-v1
continua valendo como prova de rotina, mas **sem** a leitura de antes/depois.

| Take | Embalagem (nº) | Enquadramento | Dur. | O que faz / diz (direção, não texto decorado) | Serve para |
|---|---|---|---|---|---|
| M1 | 59 | plano médio, cozinha ou quarto de manhã | 8–10 s | Manhã: conta o que faz primeiro com o celular (água, registro) em 1ª pessoa, em cena vivida, com detalhe miúdo (o copo, o horário). Sem listar o app inteiro. | hook, dia na vida |
| M2 | 59 | plano médio, mesa da refeição, celular apoiado | 8–10 s | Almoço: fotografa o prato com o celular, fala o que viu na tela (fator uau: número do app, o mesmo da gravação). Fotografar sem mostrar rótulo ou marca na mesa. | demo, dia na vida |
| M3 | 59, 14 | plano médio, sala à noite, luz de abajur | 8–10 s | Noite: o lembrete aparece, ela fala o que faz depois (registra, anota o local). Sem mostrar a aplicação. | virada, dia na vida |
| M4 | 88 | plano médio, câmera fixa | 8 s | Última objeção: "e se eu errar mesmo com o app?" Responde de frente, com algo que ela faz na prática (confere a tabela do frasco). Não promete que o app evita erro. | objeção, CTA |
| M5 | 60 | plano médio | 8 s | "É só uma calculadora?": o que mais ela usa no app, em 2 coisas concretas. Só descreve o app. | objeção |
| M6 | 53, 42, 79 | plano médio, olha para um papel ou para o celular | 15–20 s | **Carta falada:** lê uma carta que ela mesma escreveu sobre a dúvida da conta (caderno, tabela de WhatsApp, o que mudou). Detalhe vivido do começo ao fim, sem moral no final. A carta é dela; a equipe só confere compliance. | conexão, virada |
| M7 | 13, 79 | plano médio | 6–8 s | Polêmica para fora: o que ninguém explicou (bula, farmácia, grupo) e o que ela fez. Pode ser outra dor da masterlist (julgamento alheio, esconder a canetinha), contada como vivência dela. | hook (polêmica) |
| M8 | 79, 14 | plano médio | 8 s | Hook de abertura de narrado: dor em 1ª pessoa em 4,5–9 s, parando no ponto exato do corte para o app. | hook |
| M9 | 59, 62 | plano médio, mudo | 4 s | Mudo. **Alívio ao ler a tela:** olha o celular e a expressão relaxa. | virada |
| M10 | 14, 59 | plano médio, mudo | 3–4 s | Mudo. **Celular vibra, ela olha e assente** (o lembrete que o Remotion desenha). Tela virada para ela, não para a câmera. | virada, demo |
| M11 | 20, 57 | plano médio, mudo | 3–4 s | Mudo. **Mostra o celular com a tela virada para a câmera**, apagada ou com papel de parede liso. | virada, CTA |

## Takes do panda a gerar (Higgsfield)

Regras para todos os prompts:

- **Vídeo vem do Higgsfield** (decisão de 13/10/2026): `higgsfield generate create kling3_0 ...
  --aspect_ratio 9:16 --sound off`. Veja os parâmetros do modelo com `higgsfield model get kling3_0`
  (a duração aceita varia por modelo).
- **Mostrar o custo (`higgsfield generate cost`) e pedir ok antes de gerar.**
- **Consistência de personagem:** o panda gordinho dos takes existentes. Extrair um quadro de
  `panda_mexendo-celular-sofa` ou `panda_perdido-lendo-bula-quarto` (`node tools/recorte.mjs cortar`)
  e passar como `--start-image` para manter o rosto.
- Todos mudos. **Sem texto na cena, sem marca, sem tela de celular legível** (tela escura ou lisa, para
  o mockup do Remotion encaixar). Nada de número na seringa.
- Defeito visual não se corta (decisão de 07/10/2026): usar o take inteiro.
- O panda nunca fala em primeira pessoa: a narração é sobre ele ou impessoal.
- Salvar em `entrada/ozempro/panda/takes/panda_<acao>-<cenario>.mp4` e catalogar em
  `material-panda.md`.

| Take | Embalagem / uso | Prompt sugerido (em inglês) | Dur. | Por que falta |
|---|---|---|---|---|
| `panda_duvida-contando-seringa-mesa` | hook de dor da calculadora; #13 | `3D Pixar-style chubby giant panda sitting at a wooden kitchen table, holds a plain clear syringe in one paw and a small glass vial in the other, tilts the syringe toward the window light, looks confused, counts on his paw fingers, scratches his head; warm kitchen, soft daylight, no text, no logos, no numbers on the syringe, vertical 9:16, steady camera` | 10 s | Nenhum take mostra a dúvida com a seringa; pontas soltas de `material-panda.md` |
| `panda_alivio-lendo-tela-sofa` | virada; #59 | `3D Pixar-style chubby giant panda on a cozy living room sofa with plants, reads a phone held in both paws, shoulders relax, long relieved sigh, small smile, then looks up; phone screen faces away from camera with only a soft glow, no text, no logos, vertical 9:16` | 5 s | Falta o take de alívio |
| `panda_close-rosto-lendo` | virada, hook (visual) | `3D Pixar-style close-up of a chubby giant panda face lit by a soft purple phone glow, eyes move from left to right as if reading, eyebrows lift, little smile; blurred living room background, no text, no logos, vertical 9:16` | 5 s | Falta close do rosto lendo a tela |
| `panda_mao-tocando-celular-tela-lisa` | demo (encaixa o mockup do app) | `3D Pixar-style close-up of a panda paw tapping and scrolling a smartphone held facing the camera, the screen is a plain dark purple solid with no icons and no text, slow steady motion, living room sofa blurred behind, vertical 9:16` | 5 s | Falta plano de mão com tela visível para o mockup |
| `panda_aplicando-tranquilo-seringa-sala` | demo, CTA | `3D Pixar-style chubby giant panda in a cozy living room next to a bookshelf, calmly holds a plain syringe with the cap on next to his belly without touching the skin, then caps it and smiles at the camera; no text, no logos, no numbers on the syringe, vertical 9:16` | 10 s | O take existente usa caneta injetora; falta seringa e calma |
| `panda_feliz-camera-espaco-livre` | CTA | `3D Pixar-style chubby giant panda standing centered in front of a plain warm cream wall, smiles and waves one paw at the camera, large empty space above and below the character, no text, no logos, vertical 9:16, static camera` | 5 s | Não há take de CTA com espaço livre |
| `panda_tela-verde-parede-lisa` | #20 tela verde, #35 | `3D Pixar-style chubby giant panda standing on the left third of the frame in front of a plain light gray wall, looks to the right side, raises an eyebrow, reads something off-screen, then shakes his head with a smile; right two thirds empty, no text, no logos, vertical 9:16, static camera` | 5 s | #20 pede fundo liso para o mock do Remotion |
| `panda_podcast-dois-pandas-estudio` | #22 podcast | `3D Pixar-style two chubby giant pandas facing each other at a small round table with two plain black microphones on arms, one talks with expressive paws, the other nods and smiles, simple warm studio with a soft lamp and a curtain behind, no logos, no text, vertical 9:16` | 10 s | Versão panda do #22 não existe |
| `panda_ligacao-celular-tocando` | #29 ligação | `3D Pixar-style chubby giant panda sitting on a sofa, a smartphone on the cushion lights up and vibrates, the panda looks at it with surprise, picks it up and holds it to his ear; the screen is never visible to the camera, only the glow, no text, no logos, vertical 9:16` | 5 s | #29 precisa do panda atendendo |
| `panda_dia-acordando-quarto` | #59 dia na vida | `3D Pixar-style chubby giant panda wakes up in a bright bedroom, stretches both arms, yawns, sits on the edge of the bed in the morning sun; no text, no logos, no clock readable, vertical 9:16` | 5 s | Não há take de manhã |
| `panda_dia-bebendo-agua-cozinha` | #59 dia na vida | `3D Pixar-style chubby giant panda in a wooden kitchen drinks from a plain glass of water, slow sip, relieved look; a plain phone lies on the counter with a dark screen, no text, no logos, vertical 9:16` | 5 s | Não há take de água |
| `panda_dia-fotografando-prato-cozinha` | #59 dia na vida | `3D Pixar-style chubby giant panda holds a smartphone above a plate of grilled chicken and salad on a wooden kitchen table and takes a photo; the screen faces away, no text, no logos on the food or the plate, vertical 9:16` | 5 s | Não há take de foto da refeição (o app lê foto, ver `material.md`) |
| `panda_caderno-conta-mesa` | #39 antigo × novo | `3D Pixar-style chubby giant panda at a wooden desk writes with a pencil on a notebook, erases, frowns, scratches his head; the notebook shows only scribbles, no readable numbers or letters, warm light, vertical 9:16` | 5 s | O lado "jeito antigo" do #39 não existe com panda |
| `panda_lembrete-celular-sofa` | #14, #70 | `3D Pixar-style chubby giant panda on a living room sofa, a phone buzzes on the armrest with a soft purple glow, panda looks at it, nods and smiles, screen not visible, no text, no logos, vertical 9:16` | 5 s | Falta o take de lembrete |

---

## Gravações de tela que faltam

Tiradas das "Pontas soltas" de `material.md`. Uma conta de teste só, com **dados coerentes** (mesmo
peso, mesmas datas) para as telas não se contradizerem, e **nome de medicamento borrado** pela regra
de `AGENTS.md` (`tools/borrar-ocr.mjs`). Cada gravação nas versões `tela-cheia` e `mockup`, por idioma.

| Gravação | Destrava |
|---|---|
| **Onboarding** até a primeira dose cadastrada | #57 unboxing e #70 processo em etapas |
| **Chat com IA** (panda) respondendo uma dúvida | #46 perguntas frequentes |
| **Gerar Relatório Médico** (PDF/Excel) | ângulo "consulta preparada" e #36 motivos |
| **Lembretes de aplicação** (configurar e notificação) | #14 emergência, #59 dia na vida, #70 |
| **Receita aberta** com passo a passo | #36, #43 e #59 |
| **Refeição por voz ou texto** e a câmera tirando a foto | #59 e #36 |
| **Gráfico de peso real da Jornada**, com dado válido | #36 e #77 (o de Evolução tem "Invalid Date") |
| **Widget e Live Activity** | #65 tour pelo app |
| **Paywall** com a frase "Cancele quando quiser" (recorte, sem preço na tela) | #81 garantia |

---

## Ordem sugerida

1. **Vitória primeiro**: a cozinha, a seringa e o frasco já existem, o ângulo campeão é risquinhos
   e ela rende o maior número de embalagens (#33, #39, #60, #88, #13, #20).
2. **Xanda e Maria**, na mesma semana, depois de cortar a Vitória, para repor em cada pessoa o que
   a anterior não rendeu (caixinha, carta, dia na vida).
3. **Panda** em paralelo, com custo aprovado: começar pelos 6 primeiros (dúvida, alívio, rosto,
   mão, aplicando, CTA), que fecham o criativo completo de calculadora.
4. **Telas**: onboarding, chat com IA e relatório médico primeiro; os demais por demanda.
5. Sem sessão de fundador: decisão da equipe em 18/10/2026 (embalagens 23 e 90 fora).
