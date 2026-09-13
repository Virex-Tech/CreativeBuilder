# Contexto do app — OzemPro

> O Claude Code lê este arquivo antes de escrever qualquer criativo do OzemPro. A seção
> **Compliance — NUNCA** vence qualquer brief ou referência. Regras de edição (ritmo, legenda):
> `directors/ozempro.yaml`.
>
> Fontes: `AppsBrain/nucleo-server/prisma/ozempro-kb.json` (produto), `asc-translator/apps/ozempro`
> (loja), `ozempro-blogs` (marca, tom, links), ícone do app (cores). Levantado em 13/09/2026.

## Resumo

- **Nome:** OzemPro (na loja: "OzemPro: Monitor GLP-1")
- **Slug:** `ozempro` — material em `render/public/app/ozempro/`, director em `directors/ozempro.yaml`
- **Loja:** [App Store](https://apps.apple.com/br/app/ozempro-monitor-glp-1/id6753301974) ·
  [Google Play](https://play.google.com/store/apps/details?id=com.segaritz.ozempro) ·
  site [ozempro.com](https://www.ozempro.com/) (quiz: ozempro.com/quiz)
- **Idiomas:** app em 13 idiomas (pt, en, es, de, it, fr, hi, ar, ja, ko, zh, ru, tr); ficha da
  loja em ~25 locais. Criativos: **pt-BR primeiro**.

**O que é, em uma frase:** diário digital para quem faz tratamento com medicamentos GLP-1 — registra
doses, peso, alimentação, atividade e efeitos colaterais num lugar só. **Não prescreve e não
substitui orientação médica.**

Posicionamento (loja): *"diário digital simples e estruturado para acompanhar toda a jornada GLP-1
em um só app"*.

## Público

- **Quem é:** adultos em tratamento com GLP-1 (semaglutida, tirzepatida, liraglutida — incluindo
  canetas de marca e manipuladas) ou prestes a começar.
- **Situação em que baixa o app:** começou o tratamento e precisa organizar aplicações semanais,
  acompanhar sintomas e peso, e levar histórico para o médico.

## Dores (o que a pessoa sente antes do app)

1. Esquecer ou atrasar a dose / perder a conta de quando aplicou e onde.
2. Não lembrar dos efeitos colaterais da semana na hora da consulta.
3. Registrar alimentação dá trabalho (anotar macros à mão).
4. Não enxergar a própria evolução ao longo das semanas.
5. Sentir que está passando pelo tratamento sozinha.

## Promessa e funcionalidades

| Funcionalidade (nome no app) | O que resolve | Tem gravação/print? |
|---|---|---|
| **Registrar Aplicação** (dose, local, dor) + **Próxima dose** (contagem regressiva) | nunca perder dose | não — gravar |
| **Nível de medicação** (estimado) e linha do tempo na aba **Tratamento** | ver o tratamento de forma clara | não — gravar |
| **Registrar Refeição** — Escanear (foto), Falar, Digitar, Refeições salvas → revisão de macros | registrar comida sem esforço | não — gravar |
| **Registrar Efeito Colateral** | ter o histórico para o médico | não — gravar |
| **Gerar Relatório Médico** (PDF) | levar tudo pronto para a consulta | não — gravar |
| **Registrar Peso**, **Registrar Foto Pessoal**, **Jornada** (gráfico) | acompanhar evolução | não — **ver compliance** antes de mostrar |
| **Chat com IA** (com o panda) | tirar dúvidas de uso do app | não — gravar |
| **Comunidade** (grupos, ranking) | não passar por isso sozinha | não — gravar |
| Registrar Atividade, Suplementos, água, streak, Sincronização de Saúde (Apple Saúde / Health Connect), Widgets e Live Activity | hábito diário | não — gravar |

**Telas que funcionam em vídeo:** Home com cards (medicação, calorias, água, atividade, streak,
panda) · câmera escaneando refeição → macros · aba Tratamento com próxima dose · relatório médico
em PDF · chat com o panda · comunidade.

## Oferta

- **Plano:** assinatura (anual e mensal). Navegação inicial liberada; o paywall aparece ao usar um
  recurso. Compra no app (App Store/Google Play, paywall Superwall) ou no site (Stripe).
- **Preço:** varia por loja/país — **nunca citar valor nem comparar planos** no criativo.
- **Frase real do paywall:** "Cancele quando quiser".
- **CTAs reais (site):** "Baixe o app e acompanhe seu tratamento" · "Começar agora" · "Baixar app".

## Provas (só reais)

- **Nenhuma prova disponível nas fontes** (sem número de usuários, avaliação ou depoimento).
  Não use números nem depoimentos até alguém trazer dados reais e autorizados.

## Tom de voz

- **É:** acolhedor, prático, parceiro do tratamento, sem julgamento. O panda é o companheiro.
- **Não é:** milagroso, estético, "antes e depois", médico dando ordens.
- **Frases reais:**
  - "Seu acompanhante diário no tratamento com GLP-1"
  - "Nunca perca uma dose e registre tudo"
  - "Você não precisa passar por isso sozinho"
  - "Um plano nutricional feito pro seu tratamento"

## Ângulos de criativo

Todos respeitam a seção Compliance. O anúncio vende **organização do tratamento**, nunca o remédio
nem o emagrecimento.

| Ângulo | Hook de exemplo | Estrutura sugerida |
|---|---|---|
| Organização das doses | "Dose, local e horário. Tudo registrado." | hook texto → Registrar Aplicação → Próxima dose → CTA |
| Consulta preparada | "Seu histórico do tratamento em um PDF." | hook → efeitos colaterais registrados → Gerar Relatório Médico → CTA |
| Refeição em 1 foto | "Tirou foto, registrou a refeição." | hook → câmera escaneando → macros → CTA |
| Tudo num lugar só | "Dose, sintomas e refeições num app só." | montagem rápida das abas → Home → CTA |
| Companhia | "Tratamento é melhor acompanhado." | panda/chat → comunidade → CTA |

## Marca (para o `brandKit` do spec)

Cores tiradas do ícone do app (gradiente roxo). Os blogs usam rosa/azul — **não** são a cor do app.

- **bg:** `#12091F` (roxo quase preto, fundo de vídeo) · **fg:** `#FFFFFF` · **accent:** `#8630E4`
- Variações do roxo do ícone: escuro `#5C1CCB` · médio `#6A23D6` · claro `#9E40EA`
- **fontFamily:** `"'Plus Jakarta Sans', Inter, system-ui, sans-serif"` (fonte dos sites). O renderer
  não embute fontes: sem a Plus Jakarta Sans instalada na máquina, o vídeo cai na fonte do sistema.
- **Ícone:** `render/public/app/ozempro/icone.png` (1024×1024, panda com caneta) — use no CTA final,
  pequeno; a caneta não pode ser protagonista (ver Compliance).
- Logo grande (3105×3105): `ozempro-blogs/ozempro-blogs/sites/ozemblog/public/logo.png` — não copiado.

## Compliance — NUNCA

Anunciar app ligado a medicamento de prescrição é a área mais restrita das plataformas. Regras
levantadas em 13/09/2026 (Meta, TikTok, ANVISA, CONAR) — **na dúvida, não use**.

1. **Nome comercial de medicamento no vídeo ou na legenda** (Ozempic, Wegovy, Mounjaro, Zepbound,
   Saxenda...). Use "tratamento com GLP-1" ou "seu tratamento".
   *Por quê:* ANVISA RDC 96/2008 art. 27 proíbe propaganda ao público de medicamento sob prescrição
   (e art. 8º pega propaganda indireta); a ANVISA já autuou redes de farmácia por posts sobre
   Mounjaro (mai/2025). Moderação da Meta/TikTok barra por palavra-chave. Novo Nordisk processa
   ativamente uso comercial das marcas.
2. **Promessa de emagrecimento**, quilos perdidos, "resultado garantido", "fácil".
   *Por quê:* TikTok Weight Management (endurecida em ago/2026); Meta Health & Wellness; CONAR
   Anexo G proíbe prometer resultado.
3. **Antes e depois, foto de progresso em destaque, close em barriga ou partes do corpo**,
   mensagens que façam a pessoa se sentir mal com o corpo.
   *Por quê:* Meta proíbe foco em partes do corpo e autoimagem negativa; TikTok idem.
4. **Hook que afirma a condição de saúde de quem assiste** ("Você que toma GLP-1...",
   "Tomando Ozempic?"). Descreva a situação, não a pessoa.
   *Por quê:* Meta proíbe implicar conhecimento de atributo de saúde do usuário.
5. **Depoimento de pessoa sobre perda de peso.**
   *Por quê:* CONAR Anexo G veda testemunhal de leigos em tratamento de emagrecimento.
6. **Injeção sendo aplicada, agulha em close, caneta como protagonista.**
   *Por quê:* boa prática — dispara revisão de medicamento na moderação.
7. **Sugerir dose, troca de medicamento, uso sem médico ou que o app substitui o médico.**
8. **Preço, desconto ou comparação de planos.**
9. **Números, avaliações ou depoimentos sem fonte real.**

**Sempre:**

- Público **18+** na campanha (Meta e TikTok para saúde/peso).
- Quando o vídeo falar de tratamento, feche com o aviso curto na tela:
  *"O OzemPro não substitui orientação médica."*
- Mostrar o app como **diário/organizador**.

> **Risco do negócio, não do criativo:** o próprio nome "OzemPro" e as keywords da loja citam
> Ozempic/Mounjaro. A pesquisa aponta risco de marca registrada no nome do produto. Decisão da
> liderança com advogado — não resolva isso num criativo.

## Material disponível

- `render/public/app/ozempro/icone.png` — ícone do app.
- **Faltam gravações de tela.** Prioridade: Home, Registrar Aplicação + Próxima dose, escanear
  refeição, Gerar Relatório Médico, chat com o panda. Use conta de teste (sem dados reais de
  pessoas) e evite mostrar peso/foto corporal.
