# Roteiro — narrado · platô · pt-BR (aprovado pela equipe em 19/10/2026)

Etiquetas: **E79 narrado (pessoa real)** · **D1-platô** (com risquinhos como 2ª função) ·
**Hconexao** · narrado · pt-BR · fonte: pessoa real (a definir quem) + app.

**Hook de texto** (caixa roxa fixa, some no corte para o app): "O QUE EU VI NO GRÁFICO MUDOU TUDO"

**Duração estimada:** 128 palavras ≈ 33 s a 3,8 palavras/s.

| Tempo (aprox.) | Tela | Fala |
|---|---|---|
| 0–7 s | Pessoa na câmera | Eu quase desisti das canetinhas quando entrei no efeito platô. Mas a minha sorte foi que encontrei o app OzemPro, e ele me ajudou a enxergar o que eu tava fazendo errado. |
| 7–12 s | Jornada: gráfico de peso (linha reta) | A balança tinha travado três semanas. No gráfico eu vi a linha reta, e vi que não estava batendo a meta de proteína do dia. |
| 12–17 s | Registrar Refeição: foto do prato → macros | Comecei a tirar foto do prato. E ele calcula quanto de proteína, fibra e gordura tem na refeição. |
| 17–23 s | Calculadora de Doses: resultado na seringa | E a parte que eu tinha mais medo: calcular os risquinhos. Digito o frasco e a dose, ele me mostra certinho o quanto preciso puxar pra não ter erro. |
| 23–29 s | Registrar Aplicação (local no corpo) → Tratamento: próxima dose | Registro o local onde apliquei, e ele me avisa o dia da próxima aplicação. Acabou a dúvida de qual lado apliquei semana passada. |
| 29–33 s | Home do app | Deixei o link aqui embaixo pra você baixar o app. Não perca tempo. |

## Texto corrido (para a locução)

Eu quase desisti das canetinhas quando entrei no efeito platô. Mas a minha sorte foi que encontrei o app OzemPro, e ele me ajudou a enxergar o que eu tava fazendo errado. A balança tinha travado três semanas. No gráfico eu vi a linha reta, e vi que não estava batendo a meta de proteína do dia. Comecei a tirar foto do prato. E ele calcula quanto de proteína, fibra e gordura tem na refeição. E a parte que eu tinha mais medo: calcular os risquinhos. Digito o frasco e a dose, ele me mostra certinho o quanto preciso puxar pra não ter erro. Registro o local onde apliquei, e ele me avisa o dia da próxima aplicação. Acabou a dúvida de qual lado apliquei semana passada. Deixei o link aqui embaixo pra você baixar o app. Não perca tempo.

## Para produzir

- Pessoa grava só os primeiros 7 s na câmera (hook); o resto é voz em off (dela ou Gemini TTS,
  voz Achernar) sobre o mockup. A pessoa não volta, nem no CTA.
- Telas: `app/ozempro/br/` — tratamento (gráfico), registro_alimentacao, calculadora,
  aplicacao, pagina_inicial. Escolher `startFromMs` pelo que a tela mostra (`recorte.mjs amostra`).
- Sem texto sobre a gravação de tela; legenda karaokê só enquanto a pessoa fala.
