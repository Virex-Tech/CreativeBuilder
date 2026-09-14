# Comece aqui — CreativeBuilder

Guia para quem vai usar a ferramenta pela primeira vez. Não precisa saber programar: você
conversa com o **Claude Code** em português e ele faz o trabalho. Siga na ordem.

---

## 1. O que é

O CreativeBuilder cria **vídeos de anúncio para apps** (formato Reels/TikTok, 1080×1920).

Você pede, por exemplo, *"faz um criativo de 20s pro TapFit sobre não saber o que treinar"*,
e o Claude Code:

1. escreve o roteiro do vídeo (cenas, textos, tempos);
2. gera as cenas com IA no **Higgsfield** (pessoas reais, ambientes do dia a dia) e a **voz**;
3. coloca a **tela real do app** dentro de um celular, se você tiver a gravação;
4. edita tudo com o **Remotion** — legenda que acompanha a voz palavra por palavra, transições,
   efeitos sonoros — e exporta o **MP4**;
5. **confere o vídeo** antes de te entregar (cenas vazias, legenda fora de sincronia, texto ilegível).

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

### 3.0 Preparar o Windows

Rode estes dois comandos:

```powershell
winget --version
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

- O primeiro tem que mostrar um número de versão (ex: `v1.9...`). Se aparecer *"não é
  reconhecido"*, abra a **Microsoft Store**, procure **Instalador de Aplicativo** (App Installer),
  clique em **Instalar/Atualizar**, feche e abra o PowerShell e tente de novo.
- O segundo libera o Windows a rodar as ferramentas que vamos instalar. Se perguntar algo, digite
  `S` (ou `Y`) e Enter.

### 3.1 Programas básicos

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
winget install Python.Python.3.13
winget install Microsoft.VisualStudioCode
winget install Anthropic.ClaudeCode
```

Se aparecer uma pergunta sobre termos, digite `Y` e Enter.

> **Importante:** depois disso, **feche o PowerShell e abra de novo**. Sem isso o Windows não
> "enxerga" os programas novos.

### 3.2 Ferramenta do Higgsfield e da legenda sincronizada

```powershell
npm i -g @higgsfield/cli
python -m pip install faster-whisper
```

A primeira legenda sincronizada baixa um arquivo de ~460 MB (modelo de transcrição) — é uma vez só.
Se aparecer um aviso amarelo sobre *symlinks* ou *Developer Mode*, pode ignorar.

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

Você só conversa. Alguns pedidos prontos para copiar e adaptar.

### Escolha o tipo de vídeo

| Tipo | Quando usar | Como pedir |
|---|---|---|
| **100% IA** | não tem gravação do app | *"cria um criativo do OzemPro 100% com IA"* |
| **Com o app** | tem gravação de tela do app | *"cria um criativo do OzemPro com a gravação entrada/ozempro/home.mp4"* |
| **Imagem no final** | quer terminar com um print ou oferta | *"cria um criativo do OzemPro terminando com a imagem entrada/ozempro/loja.png"* |

Se você não disser, ele pergunta. Em todos: vídeo em todas as cenas, voz humana, legenda
embaixo destacando cada palavra falada.

### Pedidos prontos

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

**Anexando seus vídeos e imagens**

1. Arraste os arquivos para a pasta **`entrada`** do projeto (dá para fazer pelo VS Code: arraste
   para a pasta `entrada` na lista de arquivos da esquerda). Crie uma subpasta por app se quiser.
2. Peça dizendo o nome do arquivo e o que fazer com ele:
> usa o vídeo entrada/ozempro/uso-do-app.mp4 na cena 2, do segundo 12 ao 18

> analisa as fotos em entrada/ozempro e me diz quais servem pra gerar o b-roll

> coloca a imagem entrada/ozempro/tela-relatorio.png em tela cheia na cena final

O Claude corta o trecho, coloca no vídeo e mostra o preview. A pasta `entrada` **não vai para o
GitHub** (é material bruto); só o trecho usado vai.

**Usando vídeos e imagens do Google Drive**

Instale o **Google Drive para computador** (`winget install Google.GoogleDrive`), entre com a conta
da empresa e espere aparecer a unidade **G:** no Explorador de Arquivos. Depois é só dizer o
caminho da pasta:
> analisa os vídeos em G:\Shared drives\Marketing\OzemPro\UGC e me diz quais servem pro criativo

> usa as fotos de G:\My Drive\OzemPro\fotos como base pra gerar o b-roll da cena 2

O que dá para fazer com o material do Drive:
- **Analisar** vídeos (cortes e cenas) e imagens.
- **Usar na edição:** vídeo real em tela cheia, gravação/print do app com ou sem o celular em volta.
- **Gerar no Higgsfield a partir dele:** uma foto vira o começo ou o fim do clipe gerado, ou serve
  de referência de cenário/estilo. Gasta créditos — ele pergunta antes.

Cuidados:
- Na primeira vez ele pede permissão para ler a pasta do Drive: clique em **Allow**.
- Arquivo que está "só online" no Drive baixa na hora — vídeo grande demora.
- O Claude copia para o projeto só o trecho que usar; o material bruto fica no Drive.
- **Rosto de pessoa real** (em referência ou no vídeo) só com autorização dela.
- Vídeo com **música de outra pessoa/artista** não pode ir para o anúncio.
- As regras de cada app continuam valendo (ex: no OzemPro, nada de close no corpo).

**Variações** (para testar o que funciona melhor)
> gera 3 variações do hook do criativo tapfit-treino-aleatorio

> faz a versão em espanhol

> faz uma versão 4:5 de 15 segundos

**Outros idiomas**
> faz a versão em inglês e em espanhol do criativo ozempro-doses, com voz nativa em cada idioma

Ele traduz adaptando (não ao pé da letra), gera a voz no idioma e sincroniza a legenda de novo.

**Ajustes**
> encurta o hook pra 1.8 segundos

> deixa a legenda maior

> troca o b-roll da cena 1 por um homem correndo na esteira

**Locução e legenda palavra por palavra** (a palavra falada fica destacada na cor do app)
> cria uma locução em português pro criativo tapfit-5-semanas e sincroniza a legenda com a voz

> usa a minha gravação entrada/ozempro/narracao.m4a como locução e deixa a legenda destacando
> palavra por palavra

Gerar a locução no Higgsfield custa pouco (de 0,3 a 2 créditos) — ele pergunta antes. A legenda
sincronizada é feita no seu computador, sem custo.

**Análise de resultado** (depois que o anúncio rodou)
1. No Gerenciador de Anúncios da Meta, exporte o relatório em CSV.
2. Coloque o arquivo na pasta do projeto e peça:
> analisa o CSV resultados-setembro.csv e me diz o que variar

### O que esperar em cada pedido

1. Ele mostra o **roteiro** antes de começar — confira e responda "ok" ou peça mudanças.
2. Antes de gerar vídeo de IA, ele mostra **quanto custa em créditos** e pede seu ok.
3. Ele mostra **imagens de preview** antes do vídeo final.
4. Depois do vídeo pronto, ele **confere o vídeo inteiro** (uma folha com vários quadros e o
   volume do áudio) e corrige o que estiver errado antes de te mostrar. Na primeira voz de um app,
   **ouça você** — ele não escuta áudio.
5. O MP4 final fica em `C:\Projects\creativebuilder\render\out\`.

Quando ele pedir permissão para rodar algum comando, leia e clique em **Allow**. Os comandos
normais da ferramenta já estão liberados; ele só pergunta o que é diferente — e **sempre**
pergunta antes de gastar créditos do Higgsfield.

### Como escrever um bom pedido

Quanto mais contexto, melhor o resultado. Um pedido completo diz:

- **App:** o nome basta. O contexto de cada app (o que faz, público, dores, oferta, marca e
  regras de anúncio) fica em `apps/<app>/contexto.md` e o Claude lê sozinho. Apps prontos:
  `apps/ozempro/` (o TapFit dos exemplos é só demonstração e ainda não tem contexto). Para um app novo, peça: *"cria o contexto do app X"* — ele usa o modelo
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

- **Da referência, o Claude pega as imagens e o texto falado** (transcrição), mas não o tom de voz,
  a música ou os efeitos sonoros. Se forem importantes, descreva no pedido.
- **Views e curtidas não são lidas automaticamente.** Se a referência performou bem, diga os
  números no pedido.
- **Referências analisadas ficam só no seu computador** (pasta `references/`, não vai pro
  GitHub). Para outra pessoa usar a mesma referência, mande o link.

---

## 6. Regras da equipe

- **Créditos do Higgsfield são limitados.** Um clipe de 5s custa ~6,25 créditos. Só aprove
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
- **Quando terminar algo bom**, peça: *"salva e envia pro GitHub o criativo que fizemos"*. Na
  hora de enviar, ele pede sua permissão — confira e clique em **Allow**.

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
| `render/specs/_modelos/` | **modelos de vídeo** prontos (100% IA, com app, imagem no final) |

---

## 9. Problemas comuns

| Problema | Solução |
|---|---|
| O `doctor.mjs` mostra **✘** num programa que você acabou de instalar, ou aparece *"o termo 'git' (ou node, python...) não é reconhecido"* | O terminal ainda não enxerga o programa novo. Feche **todas** as janelas do PowerShell **e do VS Code** e abra de novo. Para resolver sem fechar, cole no PowerShell: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')` |
| `a execução de scripts foi desabilitada neste sistema` (ao rodar `npm` ou `higgsfield`) | Rode `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, responda `S` e tente de novo. |
| Digitar `python` abre a Microsoft Store ou diz que não encontrou | Menu Iniciar → **Configurações** → **Aplicativos** → **Configurações avançadas de aplicativos** → **Aliases de execução de aplicativo** → desligue **python.exe** e **python3.exe**. Feche e abra o PowerShell. |
| `... não é reconhecido como nome de cmdlet` | Feche e abra o PowerShell/VS Code. Se continuar, rode `node tools/doctor.mjs` e siga o que ele disser. |
| Higgsfield diz `free plan` | Entrou na conta errada. Veja o passo 3.4 (logout + login em janela anônima). |
| Higgsfield dá erro `workspace_membership_required` | Rode `higgsfield workspace list` e `higgsfield workspace set <ID do plano pago>`. |
| Acabaram os créditos | Avise o responsável. Enquanto isso, dá para fazer variações de texto/ritmo reaproveitando clipes já gerados. |
| A palavra destacada na legenda não acompanha a voz | Peça: *"ressincroniza a legenda com a locução"*. Se continuar, o texto da legenda está diferente do que é falado — peça para igualar. |
| No vídeo aparece um quadro escrito **B-ROLL** ou **APP SCREEN** | No exemplo do primeiro teste: peça *"atualiza o projeto"* (o clipe vem do GitHub). Em criativo novo: falta o clipe ou a gravação daquela cena. Peça para gerar o b-roll ou coloque a gravação em `render/public/app/<app>/`. |
| Referência por link não baixa | Rode `winget upgrade yt-dlp.yt-dlp` e tente de novo. Se não der, baixe o vídeo e coloque o arquivo na pasta do projeto. |
| O Claude Code não entende o que é "criativo" | Confirme que o VS Code abriu a pasta `C:\Projects\creativebuilder` (não uma subpasta). |

---

## 10. Para saber mais

- `docs/COMO-USAR.md` — referência técnica dos comandos
- `render/specs/_modelos/LEIA-ME.md` — os modelos de vídeo
- `AGENTS.md` — instruções que o Claude Code segue
- `render/src/spec.ts` — todos os campos de um roteiro
