# Comece aqui — CreativeBuilder

Guia para quem vai usar a ferramenta pela primeira vez. Não precisa saber programar: você
conversa com o **Claude Code** em português e ele faz o trabalho. Siga na ordem.

---

## 1. O que é

O CreativeBuilder cria **vídeos de anúncio para apps** (formato Reels/TikTok, 1080×1920).

Você pede, por exemplo, *"faz um criativo de 20s pro TapFit sobre não saber o que treinar"*,
e o Claude Code:

1. escreve o roteiro do vídeo (cenas, textos, tempos);
2. gera as imagens em movimento com IA no **Higgsfield** (pessoas, academia, ambientes);
3. coloca a **tela real do app** dentro de um celular, se você tiver a gravação;
4. monta tudo e exporta o **MP4** com o **Remotion**.

Tudo roda **no seu computador**. Não existe chave de API para configurar.

---

## 2. Contas que você precisa (peça ao responsável)

| Conta | Para quê | Como conseguir |
|---|---|---|
| **GitHub** com acesso ao repositório `Virex-Tech/CreativeBuilder` | baixar o projeto e compartilhar o que você fizer | peça o convite ao responsável |
| **Claude** (plano Pro, Max ou Team) | usar o Claude Code | peça o acesso ao responsável ou use o seu |
| **Higgsfield** da equipe (plano pago) | gerar os vídeos de IA | peça o login ao responsável — **não use conta free** |

---

## 3. Instalação (uma vez só)

Tudo abaixo é no **Windows**. Abra o **PowerShell**: tecla Windows → digite `PowerShell` →
Enter. Copie cada bloco, cole no PowerShell e aperte Enter. Espere terminar antes do próximo.

### 3.1 Programas básicos

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
winget install Microsoft.VisualStudioCode
winget install Anthropic.ClaudeCode
```

Se aparecer uma pergunta sobre termos, digite `Y` e Enter.

> **Importante:** depois disso, **feche o PowerShell e abra de novo**. Sem isso o Windows não
> "enxerga" os programas novos.

### 3.2 Ferramenta do Higgsfield

```powershell
npm i -g @higgsfield/cli
```

### 3.3 Baixar o projeto

```powershell
git clone https://github.com/Virex-Tech/CreativeBuilder.git C:\Projects\creativebuilder
cd C:\Projects\creativebuilder\render
npm ci
cd ..
```

O `git clone` pode abrir uma janela pedindo login no GitHub — entre com a sua conta. O
`npm ci` demora alguns minutos.

### 3.4 Entrar no Higgsfield

```powershell
higgsfield auth login
```

Abre o navegador. Entre com a **conta Higgsfield da equipe**.

> Se o navegador já estiver logado em outra conta Higgsfield, ele entra nela sem perguntar.
> Nesse caso: rode `higgsfield auth logout`, rode `higgsfield auth login` de novo e abra o
> link que aparecer numa **janela anônima** (Ctrl+Shift+N no Chrome).

Depois, selecione o workspace pago:

```powershell
higgsfield workspace list
```

Vai aparecer uma tabela. Na linha em que a coluna `PLAN` **não** é `free` (ex: `lite`),
copie o valor da primeira coluna, `ID` — é um código longo parecido com
`f66c7523-a86d-434d-9a05-5875bc52c30e`. Depois rode:

```powershell
higgsfield workspace set COLE_O_ID_AQUI
```

### 3.5 Conferir se está tudo certo

Continue no mesmo PowerShell:

```powershell
cd C:\Projects\creativebuilder
node tools/doctor.mjs
```

Tem que aparecer **✔** em tudo e a frase *"Tudo pronto"*.

Na primeira vez é normal aparecer um ou mais **✘** e a frase *"N item(ns) para resolver"*.
Embaixo de cada **✘** vem o comando que resolve. Para cada um: rode o comando, **feche e abra o
PowerShell**, entre de novo na pasta (`cd C:\Projects\creativebuilder`) e rode
`node tools/doctor.mjs` outra vez. Repita até dar *"Tudo pronto"*.

---

## 4. Abrir e fazer o primeiro teste

1. Abra o **VS Code**.
2. **File → Open Folder** → escolha `C:\Projects\creativebuilder`. Se perguntar se confia na
   pasta, clique em **Yes, I trust**.
3. Instale a extensão: ícone de quadradinhos na barra da esquerda (Extensions) → busque
   **Claude Code** (da Anthropic) → **Install**.
4. Abra o Claude Code (ícone do Claude na barra lateral ou no topo do editor). Na primeira vez
   ele pede login — entre com a sua conta Claude.
5. Na caixa de texto do painel do Claude Code (embaixo, onde está escrito algo como
   *"Ask Claude"*), escreva e aperte Enter:

   > renderiza um preview do criativo de exemplo tapfit-treino-aleatorio e me mostra

6. Espere. Ele vai rodar alguns comandos — se aparecer um pedido de permissão, leia e clique em
   **Allow**. A primeira vez demora um ou dois minutos.

Quando ele terminar, vai mostrar no chat uma **imagem** (um quadro do vídeo) de uma mulher na
academia com o texto *"Chega na academia e não sabe o que treinar?"*. Se aparecer isso, está
tudo funcionando. Se aparecer um fundo escuro escrito **B-ROLL** no lugar da mulher, falta
atualizar o projeto — veja a seção 9.

---

## 5. Usando no dia a dia

Você só conversa. Alguns pedidos prontos para copiar e adaptar:

**Criativo a partir de uma referência** (vídeo que você viu e quer usar de modelo)
> faz um criativo pro TapFit usando esta referência: https://www.instagram.com/reel/...

Pode também arrastar o arquivo de vídeo para a pasta do projeto e dizer o nome.

**Criativo a partir de uma ideia**
> cria um criativo de 20s pro TapFit: pessoa que perde tempo decidindo o treino, mostra o app
> sorteando o treino, fecha com "baixe grátis"

**Usando a tela do app**
1. Grave a tela do celular (ou tire prints).
2. Copie os arquivos para `C:\Projects\creativebuilder\render\public\app\tapfit\`.
3. Peça:
> usa a gravação treino-sorteado.mp4 na cena de demo

**Variações** (para testar o que funciona melhor)
> gera 3 variações do hook do criativo tapfit-treino-aleatorio

> faz a versão em espanhol

> faz uma versão 4:5 de 15 segundos

**Ajustes**
> encurta o hook pra 1.8 segundos

> deixa a legenda maior

> troca o b-roll da cena 1 por um homem correndo na esteira

**Análise de resultado** (depois que o anúncio rodou)
1. No Gerenciador de Anúncios da Meta, exporte o relatório em CSV.
2. Coloque o arquivo na pasta do projeto e peça:
> analisa o CSV resultados-setembro.csv e me diz o que variar

### O que esperar em cada pedido

1. Ele mostra o **roteiro** antes de começar — confira e responda "ok" ou peça mudanças.
2. Antes de gerar vídeo de IA, ele mostra **quanto custa em créditos** e pede seu ok.
3. Ele mostra **imagens de preview** antes do vídeo final.
4. O MP4 final fica em `C:\Projects\creativebuilder\render\out\`.

Quando ele pedir permissão para rodar algum comando, leia e clique em **Allow**. Os comandos
normais da ferramenta já estão liberados; ele só pergunta o que é diferente — e **sempre**
pergunta antes de gastar créditos do Higgsfield.

### Como escrever um bom pedido

Quanto mais contexto, melhor o resultado. Um pedido completo diz:

- **App:** o nome basta. O contexto de cada app (o que faz, público, dores, oferta, marca e
  regras de anúncio) fica em `apps/<app>/contexto.md` e o Claude lê sozinho. Apps prontos:
  `apps/ozempro/`. Para um app novo, peça: *"cria o contexto do app X"* — ele usa o modelo
  `apps/_modelo/` e te pergunta o que faltar.
- **Ideia ou referência:** o ângulo do vídeo, ou o link/arquivo que serve de modelo.
- **Formato:** duração (ex: 20s), formato (9:16 padrão, ou 4:5), idioma.
- **Material:** se vai usar gravação de tela do app (e o nome do arquivo).
- **CTA:** a frase final (ex: "baixe grátis").

> cria um criativo de 20s pro TapFit. O app sorteia treinos de academia pra quem não sabe o
> que treinar; público são mulheres de 20 a 35 que treinam sozinhas. Usa a referência
> https://www.tiktok.com/@.../video/... como modelo de ritmo. Mostra a gravação
> treino-sorteado.mp4 na demo. Fecha com "7 dias grátis".

### Limites de hoje

- **O áudio da referência não é ouvido.** O Claude analisa as imagens de cada cena; se o hook
  da referência é **falado** (sem texto na tela), ele não pega. Descreva no pedido o que é dito.
- **Views e curtidas não são lidas automaticamente.** Se a referência performou bem, diga os
  números no pedido.
- **Referências analisadas ficam só no seu computador** (pasta `references/`, não vai pro
  GitHub). Para outra pessoa usar a mesma referência, mande o link.

---

## 6. Regras da equipe

- **Créditos do Higgsfield são limitados.** Um clipe de 5s custa ~6 créditos. Só aprove
  geração quando o roteiro já estiver certo. Reaproveite clipes nas variações (é automático).
- **A tela do app nunca é gerada por IA.** Sempre gravação ou print real. IA erra letras e
  mostra coisas que o app não tem.
- **Preview antes do vídeo final.** Sempre olhe as imagens de preview.
- **Uma mudança por variação.** Muda só o hook, ou só o CTA, ou só o ritmo — assim dá para
  saber o que fez o anúncio performar.

---

## 7. Compartilhar com a equipe

Tudo o que você cria (roteiros, clipes gerados, material do app) fica no repositório.

- **Antes de começar o dia**, peça: *"atualiza o projeto com o que a equipe enviou"*.
- **Quando terminar algo bom**, peça: *"salva e envia pro GitHub o criativo que fizemos"*.

Os MP4 finais (`render/out/`) **não** vão para o GitHub — mande pelo canal da equipe.

---

## 8. Onde fica cada coisa

| Pasta | O que tem |
|---|---|
| `apps/<app>/contexto.md` | **contexto de cada app** (produto, público, oferta, marca, regras de anúncio) |
| `render/specs/` | os roteiros dos criativos (arquivos `.json`) |
| `render/public/app/<app>/` | **você coloca** gravações de tela e prints do app |
| `render/public/broll/` | clipes gerados no Higgsfield |
| `render/out/` | **vídeos finais** (MP4) e previews |
| `references/` | referências analisadas (frames e áudio) — fica só no seu computador |
| `directors/` | regras de edição de cada app (ritmo, legendas) |
| `tools/` | ferramentas que o Claude usa (inclui `doctor.mjs`) |
| `.claude/` | instruções e permissões do Claude Code para este projeto — não mexa |
| `docs/` | documentação detalhada |
| `web/`, `server/` | plataforma web (opcional, ver `docs/COMO-USAR.md`) |

---

## 9. Problemas comuns

| Problema | Solução |
|---|---|
| O `doctor.mjs` mostra **✘** num programa que você acabou de instalar | O terminal ainda não enxerga o programa novo. Feche o PowerShell **e o VS Code** e abra de novo. |
| `... não é reconhecido como nome de cmdlet` | Feche e abra o PowerShell/VS Code. Se continuar, rode `node tools/doctor.mjs` e siga o que ele disser. |
| Higgsfield diz `free plan` | Entrou na conta errada. Veja o passo 3.4 (logout + login em janela anônima). |
| Higgsfield dá erro `workspace_membership_required` | Rode `higgsfield workspace list` e `higgsfield workspace set <ID do plano pago>`. |
| Acabaram os créditos | Avise o responsável. Enquanto isso, dá para fazer variações de texto/ritmo reaproveitando clipes já gerados. |
| No vídeo aparece um quadro escrito **B-ROLL** ou **APP SCREEN** | No exemplo do primeiro teste: peça *"atualiza o projeto"* (o clipe vem do GitHub). Em criativo novo: falta o clipe ou a gravação daquela cena. Peça para gerar o b-roll ou coloque a gravação em `render/public/app/<app>/`. |
| Referência por link não baixa | Rode `winget upgrade yt-dlp.yt-dlp` e tente de novo. Se não der, baixe o vídeo e coloque o arquivo na pasta do projeto. |
| O Claude Code não entende o que é "criativo" | Confirme que o VS Code abriu a pasta `C:\Projects\creativebuilder` (não uma subpasta). |

---

## 10. Para saber mais

- `docs/COMO-USAR.md` — comandos detalhados e plataforma web
- `docs/ATIVACAO-IA.md` — por que a IA roda local e não no servidor
- `AGENTS.md` — instruções que o Claude Code segue
- `render/src/spec.ts` — todos os campos de um roteiro
