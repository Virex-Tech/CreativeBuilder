# Mercados e idiomas — OzemPro (regras de adaptação cultural)

> Criado em 18/10/2026; regras por mercado enviadas pela equipe no mesmo dia. Até aqui a regra de
> idioma era só técnica (`locale_swap`: adaptar, não traduzir; PT/ES 20–30% mais longos; voz nova;
> material do app por pasta de idioma). Este arquivo guarda o que muda **de cultura e de mercado**.
>
> Precedência: `contexto.md` (compliance) > este arquivo > tradução literal. O que está marcado
> **a definir** é pergunta para a equipe, não regra; o Claude não inventa apelido nem restrição.

## Regra geral: adaptar, não traduzir

Vale para todo mercado (regra da equipe, 18/10/2026):

- **Texto, narração, CTA e referência cultural são refeitos** para o público daquele país. Trocar
  a legenda não é versão.
- **Os jargões abaixo são obrigatórios nos hooks** (visual, de texto e falado): é por eles que o
  público se reconhece.
- **Sem cupom** em nenhuma versão (fecha com a decisão do `formatos.md`, #92).
- **Influenciador que não fala o idioma:** grava em português e a fala é **dublada por IA** para o
  idioma, com sotaque nativo. Caminho: workflow `dubbing` do Higgsfield (`target_language`), ou
  narração nova no Gemini TTS por cima do take. A pessoa continua saindo de cena no corte para o
  app (regra do narrado), o que facilita a dublagem: só o trecho dela precisa de lábio.
- **Dor social e comida** entram como cena vivida (conexão), nunca como piada sobre quem assiste.
- Regras técnicas continuam: `locale_swap` mantém `assetId`; cenas `flex` encurtam quando o texto
  cresce; `transcribe.py --lang`; borrão do nome do medicamento na tela em todo idioma.

### ⚠️ Conflito a decidir: jargão com nome de medicamento

A lista da equipe traz termos que **contêm o nome do medicamento**: "Ozempic Freeze" (es),
"Ozempic Face", "Mounjaro Burps", "Ozempic Baby" (en). A regra de compliance do `contexto.md`
proíbe o nome falado, escrito ou na legenda, em qualquer idioma. Até a equipe decidir, vale o
compliance: esses termos ficam **registrados mas não usados**; o Claude usa o equivalente sem
marca ("freeze", "face", "sulfur burps", "baby scare"). Se a equipe liberar o nome dentro de
jargão consagrado, anotar aqui com data.

## Os seis pontos que mudam por mercado

| Ponto | Por que importa | Onde a resposta mora |
|---|---|---|
| **Apelido do medicamento e jargões** | compliance + reconhecimento imediato | tabela de cada mercado |
| **Prática de uso** | frasco + seringa ("risquinhos") × caneta pronta (cliques) muda o hook campeão | tabela de cada mercado |
| **Dores que pesam** | custo, escassez, burocracia e pressão social variam | tabela de cada mercado + `masterlist-dores.md` |
| **Regulação e sistema de saúde** | receita, convênio, restrição local | tabela de cada mercado |
| **Moeda** | nunca valor na tela (decisão 18/10), mas a moeda citada em fala/cena tem de ser a local | tabela de cada mercado |
| **Embalagens que fazem sentido** | app de mensagem, rede, referência cultural dos mocks | tabela de cada mercado + `formatos.md` |

## pt-BR (Brasil) — mercado base

- **Apelidos:** moun moun · moun · tirze · canetinha · caneta · picadinha (`contexto.md`).
- **Prática:** frasco manipulado + seringa é comum; "risquinhos" (UI da seringa). Ângulo campeão
  validado (criativos 105, 98, 112).
- **Dores que pesam:** fracionamento, custo da caneta, escassez na farmácia (Tier 1), platô.
- **Embalagens nativas:** WhatsApp (#5), caixinha do story (#10), grupo do Facebook (#8).
- **Moeda:** R$ (sem valor na tela).

## es (América Latina e Espanha) — pasta `ltm`

Adaptar para o **espanhol latino-americano**; a Espanha usa a mesma versão salvo pedido.

| Nosso termo | Em espanhol |
|---|---|
| a caneta | **pluma** |
| a balança | **báscula** |
| a injeção / agulhada | **pinchazo** |
| efeito platô | **estancamiento** · **meseta** |
| frio constante | "Ozempic Freeze" ⚠️ (ver conflito acima; usar "freeze" sem marca até decisão) |
| arrotos de enxofre | **eructos de azufre** |
| fracionamento de dose | **fraccionamiento** |
| social / comida | a morte das **tapas** e dos **asados** |

- **Narração:** influenciador que não fala espanhol grava em português e é dublado por IA com
  sotaque latino. **Sem cupom** na versão impulsionada.
- **Prática (pesquisa 18/10/2026):** **caneta original (pluma) é o padrão legal e majoritário.**
  Versão manipulada em frasco não tem registro no México (alertas da COFEPRIS em fev/mar 2026
  contra frascos, cartuchos e canetas falsas vendidos online), nem na Colômbia (só produto com
  registro INVIMA); na Argentina há canetas de marca local e a manipulada circula sem
  respaldo oficial. **Hook:** pluma + pinchazo + fraccionamiento (dividir a dose da caneta), e o
  medo do produto falso. **Risquinhos/units de seringa valem aqui também** (decisão da equipe, 18/10/2026: o frasco
  circula pelo preço, mesmo sem registro); a calculadora pode ser a tela principal.
- **App de mensagem para o mock #5:** WhatsApp (mesmo do Brasil).
- **Moeda:** a da versão (MXN, ARS, COP…): a definir por país se houver segmentação.

## fr (França, Suíça, Canadá) — pasta `fr`

Jargões **obrigatórios nos hooks**:

| Nosso termo | Em francês |
|---|---|
| a caneta | **le stylo** · mon stylo (`contexto.md`, 14/10) |
| a injeção / agulhada | **la piqûre** · ma piqûre |
| efeito platô | **l'effet palier** |
| falta de estoque | **rupture de stock** (gatilho emocional altíssimo) |
| ruído mental (food noise) | **bruit mental** |
| efeitos colaterais | **effets secondaires** |
| a receita médica | **l'ordonnance** |

- **Sistema de saúde e burocracia:** cortes pela **"Sécu"** (França) ou **RAMQ** (Québec).
- **Mercado paralelo** (restrição francesa): **marché noir**. Usar como dor/contexto (medo de
  produto falso, fila), nunca como sugestão de onde comprar.
- **Social / comida:** a morte do **apéro**, da taça de Bordeaux com queijo, luto do café com
  croissants.
- **Moeda:** euro (França), **francos suíços** (Suíça), **dólares canadenses** (Canadá). Se o
  criativo cita moeda na fala, é a do país da campanha.
- **Prática (pesquisa 18/10/2026):** **só caneta original, com receita.** Não existe manipulação
  de GLP-1 em farmácia na França; o que circula em frasco ou "peptídeo" online é ilegal e a ANSM
  derrubou 10 sites e retirou canetas falsas em jul–ago/2026 (nenhuma continha o princípio ativo).
  Prescrição e renovação enquadradas pela ANSM desde jun/2025. **Hook:** rupture de stock,
  ordonnance, piqûre, e o medo do falso (marché noir). **Units/risquinhos de seringa NÃO abrem
  criativo na França** (decisão da equipe, 18/10/2026: o frasco não é prática relevante lá). A
  calculadora continua entrando por regra, como complementar.
- **App de mensagem para o mock #5:** a definir (WhatsApp ou iMessage conforme o país).

## tr (Turquia) — pasta `tr`

Foco: **dor financeira local** e **pressão social forte**. Termos exatos:

| Nosso termo | Em turco |
|---|---|
| a caneta | **kalem** |
| a injeção / agulhada | **iğne** |
| efeito platô | **plato dönemi** |
| pressão / julgamento social | **mahalle baskısı** ("pressão do bairro", fofoca da vizinhança) |
| desperdício da última gota | **son damla israfı** |
| pânico de medicamento falso | **sahte ilaç paniği** |

- **Moeda:** liras turcas. **Cidades foco:** Istambul ou Ancara (cenário e referência).
- **Social / comida:** a morte dos **meze**, luto do café turco da manhã; consequências ao comer
  **baklava**, **kebab** ou beber **rakı** ("bir kadeh sonrası felaket").
- **Prática (pesquisa 18/10/2026):** **só caneta original, com receita, sem reembolso** para
  obesidade (paga-se tudo do bolso: a dor financeira que a equipe apontou). Frasco só existe como
  **falso**: "peptídeos" em flakon vendidos no Instagram como "kalem barato", com alertas de
  médicos em jun–jul/2026. **Hook:** kalem + iğne + sahte ilaç paniği + son damla israfı (a última
  gota da caneta). **Units/risquinhos de seringa NÃO abrem criativo na Turquia** (decisão da
  equipe, 18/10/2026). A calculadora continua entrando por regra, como complementar.
- **App de mensagem:** a definir (WhatsApp é forte na Turquia; confirmar).

## en (EUA, Canadá, Reino Unido, Austrália) — pasta `en`

Explora termos técnicos e financeiros do sistema de saúde norte-americano e abreviações sociais.

| Tema | Em inglês |
|---|---|
| convênio e finanças | **"Prior Auth" (PA) nightmare**, **appeal** (EUA/Canadá), **the "Savings Card" shock**, **out-of-pocket** |
| medidas e ferramentas | **units** na seringa; **contar os cliques no KwikPen** (medo de perder a **"5th dose"**) |
| efeitos colaterais famosos | "Ozempic Face" ⚠️, **"Pancake Butt"** (perda de glúteos), **"Sulfur Burps"** / "Mounjaro Burps" ⚠️ |
| psicológico | **the "Day 5 Slump"**, **food noise**, "Ozempic Baby" scare ⚠️ |
| logística | **"Dr. Google Panic"**, **TSA / airport panic** (viajar com a caneta) |

⚠️ = contém nome de medicamento; ver "Conflito a decidir" no topo.

- **Prática (pesquisa 18/10/2026):** **EUA é o único mercado onde frasco + seringa é prática
  grande e legal.** Pesquisa Gallup (jun/2026): 66% dos usuários usam produto de marca, 18–19%
  manipulado (pico de ~30% em 2024, caindo: a FDA propôs em abr/2026 tirar essas moléculas da
  lista de manipulação). E mesmo a marca vende **frasco de dose única com seringa** direto ao
  consumidor, ao mesmo preço da caneta desde fev/2026. Então nos EUA convivem três gestos:
  **units** na seringa (frasco, manipulado ou de marca), **cliques** na caneta multidose e a caneta
  pronta. **Reino Unido, Austrália e Canadá: só caneta** (Austrália proibiu manipulação em
  out/2024; no Reino Unido frasco online é mercado negro, com canetas falsas apreendidas em 2025–26;
  Canadá tem manipulação só em algumas províncias, sem fonte oficial). **Hook EUA:** units e
  5th dose valem; **UK/AU/CA:** cliques e dose da caneta, Prior Auth não se aplica fora dos EUA.
  **Units valem em todos os mercados de inglês** (decisão da equipe, 18/10/2026); a calculadora
  pode ser a tela principal. Se o app também calcula cliques de caneta, a definir.
- **Apelido da caneta:** a definir ("pen" é genérico; a equipe não listou apelido).
- **Mercado principal:** EUA pelo vocabulário (Prior Auth, TSA); Reino Unido e Austrália usam a
  mesma versão salvo pedido.
- **App de mensagem para o mock #5:** iMessage/SMS (EUA); a definir para os demais.
- **Moeda:** USD, CAD, GBP, AUD conforme a campanha (sem valor na tela).

## Conclusão da pesquisa de 18/10/2026: frasco + seringa × caneta

| Mercado | O que a pesquisa achou | Hooks do mercado (além de units) |
|---|---|---|
| Brasil | frasco manipulado + seringa é comum | risquinhos (validado) |
| EUA | caneta majoritária; frasco + seringa é minoria grande e legal (manipulado e de marca) | units / 5th dose / Prior Auth |
| UK · AU · CA | caneta original é o legal; frasco circula por fora | cliques, dose da caneta, falso |
| LATAM (es) | caneta original é o legal; frasco circula por fora | pluma, pinchazo, fraccionamiento, falso |
| França | caneta original, com receita; frasco circula por fora | rupture de stock, ordonnance, piqûre |
| Turquia | caneta original, sem reembolso; frasco circula por fora | kalem, iğne, sahte ilaç, son damla |

**Regra da equipe (18/10/2026), que vence a pesquisa:** o hook de **units/risquinhos na seringa
vale em br, en e ltm**: mesmo onde o frasco não tem registro, é muito usado pelo preço, e é esse
público que o criativo procura. Nesses três a calculadora pode ser a tela principal. **Em fr e tr,
units não abre criativo**: o hook é o local (stylo, rupture de stock, ordonnance; kalem, iğne,
sahte ilaç, son damla) e a calculadora entra como complementar. Fontes no fim.

## Como pedir um criativo em outro mercado

1. Mercado e país da campanha (define moeda, sistema de saúde e app de mensagem).
2. A dor do hook, escolhida entre os jargões obrigatórios daquele mercado.
3. Se a pessoa real fala o idioma ou se vai ser dublada.
4. Qualquer "a definir" desta página que o pedido precise: responder no pedido e o Claude grava
   aqui como decisão, com data.

## Checklist de adaptação (vale além da tradução)

- [ ] Jargão obrigatório do mercado no hook (texto, fala e visual).
- [ ] Nenhum nome de medicamento, inclusive dentro de jargão (até decisão em contrário).
- [ ] Units/risquinhos abrem criativo só em br, en e ltm; em fr e tr o hook é o local.
- [ ] Referência social e de comida do país na cena vivida.
- [ ] Moeda e sistema de saúde do país; sem valor na tela; sem cupom.
- [ ] Mocks de interface no app de mensagem/rede que o público usa.
- [ ] Material do app da pasta do idioma, nome de medicamento borrado.
- [ ] Voz ou dublagem no idioma com sotaque nativo; cenas `flex` encurtadas se o texto cresceu.

## Fontes da pesquisa (18/10/2026)

- EUA: [Gallup, uso de GLP-1 (jun/2026)](https://news.gallup.com/poll/712157/glp-usage-reaches-new-high.aspx) · [BioPharma Dive, manipulados](https://www.biopharmadive.com/news/compounders-glp1-issues-for-big-pharma-gallup/825627/) · [IQVIA, canal manipulado](https://www.iqvia.com/locations/united-states/blogs/2025/10/non-traditional-channels-the-compounded-glp-1-market) · [Stanford, FDA e manipulação (jul/2026)](https://med.stanford.edu/news/insights/2026/07/glp1s-compounded-why-doctors-worry-about-safety.html) · [CNBC, frascos de marca (dez/2025)](https://www.cnbc.com/2025/12/01/eli-lilly-prices-zepbound-weight-loss-drug-vials.html) · [Lilly, frascos de dose única](https://investor.lilly.com/news-releases/news-release-details/lilly-releases-zepboundr-tirzepatide-single-dose-vials-expanding)
- UK/AU/CA: [MHRA, alerta de produtos ilegais online](https://www.healthcare-management.uk/mhra-urges-public-avoid-illegal-online-weight-loss-medicines) · [apreensões no Reino Unido](https://www.hobbsindependent.net/mhra-seizes-thousands-illegal-weight-loss-injections-black-market-concerns/) · [Austrália, proibição de manipulação](https://preptide.com.au/glp1-australia) · [Canadá por província (fonte comercial)](https://helloregimen.com/blog/compounded-glp1-canada-2026)
- LATAM: [COFEPRIS, alerta tirzepatida ilegal (fev/2026)](https://endocrinologia.org.mx/alerta-sanitaria/comercializacion-ilegal-de-productos-con-tirzepatida/) · [N+, riscos](https://www.nmas.com.mx/salud/semaglutida-y-tirzepatida-alertan-por-riesgos-de-medicamentos-para-bajar-de-peso/) · [Colômbia, registro INVIMA](https://www.somosamalia.com/blog/glp-1) · [Argentina, ANMAT nova dose (set/2026)](https://www.pharmabaires.com/3759-obesidad-anmat-aprueba-una-nueva-dosis-de-semaglutida-que-permite-personalizar-los-tratamientos-en-argentina.html) · [Argentina, preços de caneta](https://www.alfabeta.net/precio/dutide.html)
- França: [ANSM, peptídeos vendidos online](https://ansm.sante.fr/actualites/peptides-vendus-en-ligne-ne-les-utilisez-pas-ils-peuvent-etre-dangereux) · [ANSM, polícia sanitária contra sites](https://ansm.sante.fr/actualites/lansm-prend-des-mesures-de-police-sanitaire-a-lencontre-des-sites-internet-vendant-des-aglp-1) · [Vidal, luta contra venda ilegal](https://www.vidal.fr/actualites/38131-l-ansm-intensifie-sa-lutte-contre-la-vente-illegale-d-analogues-du-glp-1-et-de-peptides-en-ligne.html) · [ANSM, regras de prescrição](https://ansm.sante.fr/actualites/impression/5375)
- Turquia: [Habertürk, falso (jul/2026)](https://www.haberturk.com/video/tv/izle/haberturk-manset-1-temmuz-2026-sahte-zayiflama-ignesi-nasil-anlasilir/913933) · [Mynet, alerta de falsos](https://haber.mynet.com/sahte-zayiflama-ignesi-alarmi-uzmanlardan-kritik-uyari-110107299953) · [Dr. Doğanay, frascos falsos](https://drsahindoganay.com.tr/tedavi-rehberi/zayiflama-i-gneleri-mounjaro-wegovy-ozempic-hangisi-en-etkilisi) · [reembolso](https://www.drozdogan.com/saxenda-nedir-fda-onayi-turkiye-ruhsati-fiyati-ve-geri-odeme-durumu/) · [venda sem receita, base legal](https://hukukcularevi.com/zayiflama-ignesi-semaglutid-recetesiz-satis-kullanim-eczaci-satici-kullanici-1262-1-19-6197-24-43-44-tck-186-187-193-1219-25/)
