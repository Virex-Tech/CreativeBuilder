# Modelo comum — anúncios animados com mascote panda (OzemPro)

Base: anima-panda-01 a 04 (25–38 s, 9:16, animação 3D realista de panda, narração feminina TTS, legenda karaokê queimada, mockups do app).

## Ordem dos blocos e tempos típicos
| Bloco | Tempo típico | O que é |
|---|---|---|
| HOOK | 0–3,5 s | pergunta, estatística ou promessa falada + panda em pose icônica (espelho, caneta, lixeira) |
| DOR | 3,5–11 s (até ~19 s no 03) | 1–2 cenas do panda sofrendo (bula, náusea no sofá, comida em excesso, balança) |
| VIRADA | ~11–15 s | frase pivô: "O que muda para quem continua?", "Registrar cada sintoma...", "O tratamento funciona quando você entende..." |
| DEMO (app) | de ~12–19 s até o fim ou ~28 s | mockup do app quase em tela cheia sobre o fundo desfocado |
| PROVA | ~23–35 s | panda transformado (01, 04) ou prova social/comunidade (02); no 03 a prova é só a demo |
| CTA | últimos 3–5 s | "Clique no link e baixe o aplicativo..." |

## O que o hook sempre faz
- Fala começa no segundo 0 (sem silêncio, sem logo) e cita o remédio (Mounjaro) ou o resultado: "O que acontece com seu corpo...", "70% abandonam...", "Você sabia que... do jeito errado?", "E se você começar...".
- Gatilho de curiosidade ou medo (o que vai acontecer, o erro, a desistência), com o panda já no cenário-padrão (sala quente, espelho/caneta).
- Legenda maior e em mais linhas só na primeira frase (01 e 04); depois 1 palavra por tela.

## Como a dor é mostrada
- Sempre pelo panda, nunca por pessoas: bula espalhada na cama (confusão), copo d'água no sofá com cara enjoada (náusea), jogar a caneta no lixo (desistência), torre de hambúrguer (erro alimentar), balança (150 -> 149 kg).
- Mesma sala e poucas cenas reaproveitadas entre os vídeos (consistência de personagem e cenário).
- A fala nomeia sintoma/medo em frases curtas ("Náusea. Sem apetite.").

## Quando o app entra
- Entre 40% e 62% do vídeo (~11,9 s no 02, ~13,5 s no 04, ~15 s no 01, ~19 s no 03) e fica de 8 a 13 s. Sempre depois da dor e logo após a frase de virada.
- Sempre como mockup de celular grande (borda roxa) à frente do panda desfocado, com telas reais do app: Registrar Efeito Colateral, Tratamento/dose, Registrar Aplicação, Comunidade, gráfico de medicação. Nunca tela gerada por IA.

## Como é o CTA
- Falado nos últimos 3–5 s: "Clique no link e baixe o aplicativo para acompanhar seu tratamento..." (01, 03, 04) ou "Entra na comunidade, clique no link e baixe agora" (02).
- Visual: só o 01 tem a caixa roxa "CLIQUE NO LINK / BAIXE O APP"; os outros fecham no app/panda sem selo. Oportunidade de padronizar com a caixa do 01.
- O CTA liga o benefício (clareza, evolução, "de verdade") à ação de registrar.

## Padrões técnicos
- Narração feminina TTS, ~2,5–3 palavras por segundo, sem música identificada; legenda karaokê 1 palavra por tela, caixa alta, branca com contorno preto, terço inferior; rótulos "DIA N" no topo.
- Ritmo médio de 2,2–3,6 s por plano (14, 6, 11 e 11 cortes); acelera no começo ou na troca de telas do app.
- Erros de legenda/rótulo nas referências a não repetir: "3 0 DIAS" (01), rótulos DIA 365/DIA 01 trocados (04), tamanhos de palavra irregulares. O Whisper errou o nome do remédio (manjaro, mondial, monjado, mundiário): conferir à mão.

## Regras práticas para montar um novo no mesmo padrão
1. Primeira frase falada começa no frame 0 e entrega a pergunta/estatística/erro em até 3 s, com o panda em pose forte no primeiro plano.
2. Estrutura de 25–38 s: hook 3 s, dor 6–8 s, virada 2 s, demo do app 10–13 s, CTA 3–5 s.
3. Uma ideia por plano de 2–4 s; mudar o cenário do panda (espelho, sofá, cozinha, balança) a cada frase de dor; reaproveitar 4–5 cenários.
4. Mostrar o app só depois da dor e da frase de virada ("registrar cada sintoma"), em mockup grande, com 3–5 telas diferentes em sequência rápida.
5. Texto sempre renderizado pelo Remotion (karaokê palavra a palavra, caixa alta, contorno preto, terço inferior), com números e rótulos "DIA N" conferidos contra a fala.
6. Se usar linha do tempo (Dia 1/7/14/30), rótulo no topo sincronizado com a fala e evolução corporal do panda coerente com o dia.
7. CTA falado + caixa roxa de 2 linhas ("CLIQUE NO LINK / BAIXE O APP") nos últimos 4 s, fechando no app ou no panda com o celular.
8. Narração feminina calma e direta; frases curtas (3–8 palavras) na dor; nomear o remédio uma vez no hook; antes de usar marca de medicamento ou transformação corporal (as referências fazem isso), conferir o compliance em apps/ozempro/contexto.md.
