# Roteiro — o que é só do OzemPro

As regras gerais de roteiro (formatos, hooks, posições na tela, frase de efeito proibida,
legendas, medidas, CTA) estão em **`docs/regras-criativo.md`** e valem aqui também. Este arquivo
tem só o que é deste app.

### Material disponível para os formatos B e C

- **Filmagens de pessoas reais:** `entrada/ozempro/filmagens/` — catálogo em
  `material-filmagens.md` (quem aparece, o que fala, para que serve cada uma).
- **Takes do panda:** `entrada/ozempro/panda/` — catálogo em `material-panda.md`. Servem no lugar
  da pessoa real na abertura, tanto no narrado quanto no viral.
- **Gravações de tela do app:** `entrada/ozempro/gravacoes/` — catálogo em `material.md`.
- **Fundo desfocado atrás do mockup:** qualquer take do panda ou filmagem, pré-desfocado com
  ffmpeg (`gblur=sigma=26,eq=brightness=-0.22:saturation=0.85`) — **não** desfoque em tempo real
  no Remotion, que derruba o compositor.

### As dores que as referências mais testam

Contagem nas 13: **risquinhos / fracionamento da dose em 5** (narrado 03, viral 02/03/04/05),
**platô em 3** (narrado 02/05/07), queda de cabelo em 2, flacidez em 1, comunidade em 1.
Risquinhos é também o ângulo campeão dos criativos validados da CA01 — duas fontes
independentes apontando para a mesma dor. Lista completa: `masterlist-dores.md`.

### A calculadora entra sempre (regra da equipe, 14/10/2026)

**A Calculadora de Doses — quantos "risquinhos" puxar na seringa — tem de aparecer em TODO
criativo**, qualquer dor no hook, qualquer formato. É a dor mais forte do público, e a equipe não
quer nenhum criativo sem ela.

- Pode ser a **1ª, a 2ª ou a 3ª** inserção do app; a ordem é livre.
- Quando a dor do hook é outra (platô, flacidez, cabelo), a calculadora entra como complementar —
  mas entra.
- No **viral**, que mostra uma ferramenta só, essa ferramenta é a calculadora (é o que as 4
  referências virais de risquinhos fazem).
- Gravação: `app/ozempro/<idioma>/calculadora-calcular-risquinho-na-seringa.mp4`.

**Exceção — recriação de referência (14/10/2026):** quando o pedido é recriar uma referência
**exatamente** ("mesmo criativo, mesmo roteiro"), a referência manda. Não acrescente
funcionalidade, tela do app, frase nem elemento que não estão nela — nem a calculadora. Reprovado
em 14/10/2026: numa recriação do `ref_anima-panda-01`, que mostra três telas, foi inserida uma
quarta (a calculadora) por causa da regra acima. A regra da calculadora vale para criativo que
**nós** escrevemos, não para cópia de estrutura.

Na dúvida sobre o que a referência mostra, a ficha dela está em `analise/criativos/`.

## Roteiro que escalou (use de modelo)

Dor do hook: **erro no fracionamento** (Tier 1), encadeada com flacidez, queda de cabelo e fadiga
(Tier 2). Repare: empilha dores, tira a culpa da pessoa, apresenta o app e só então dispara as 3
funções em flash.

> "O que acontece com seu corpo se você usar as canetas incorretamente? Primeiro vem o pânico de
> errar a matemática da dose e perder dinheiro ou ir parar no hospital. Depois, se não come
> proteína, seu músculo desaparece, o cabelo cai aos chumaços e a fadiga crônica te impede de sair
> da cama. Mas a culpa não é do medicamento, e sim de tentar fazer tudo às cegas sem ajuda. E por
> isso existe OzemPro. Tem uma calculadora exata para saber quantos 'risquinhos' puxar. Usa
> inteligência artificial para ler a foto do seu prato e calcular sua meta de proteína. Além de
> registrar o local da aplicação e te avisar a hora exata da sua próxima injeção. Clique no link
> abaixo, baixe o OzemPro e assuma o controle do seu tratamento."

O que esse roteiro faz, na ordem: pergunta de pânico → consequência financeira/hospital →
consequências físicas em cadeia → **tira a culpa** ("a culpa não é do medicamento") → nome do app →
função principal → complementar 1 → complementar 2 → CTA.

Dores disponíveis para o hook: `masterlist-dores.md`.

## O que isso NÃO muda

- A regra de compliance continua: nunca falar nem escrever o nome do medicamento (ver
  `contexto.md`). Use canetinha, moun, tirze, picadinha.
- Defeito visual em animação (número distorcido, objeto que some, mão estranha) **não é motivo para
  cortar** — ver `material-panda.md`.

