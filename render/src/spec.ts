import { z } from "zod";

/**
 * CreativeSpec — the single source of truth for a creative.
 *
 * The AI never "edits video": it writes and rewrites this JSON, and the renderer is a pure
 * function of it. That is what makes a variation a diff, a duplicate a clone+patch, and an
 * adjustment a single field change.
 *
 * This schema is the contract between the API, the agents and this renderer. Keep it
 * versioned (`specVersion`) — a spec stored today must still render a year from now.
 */

export const sceneRole = z.enum(["HOOK", "PROBLEM", "DEMO", "PROOF", "CTA", "POINT"]);

/**
 * APARÊNCIA do texto, separada da animação (19/10/2026).
 *
 * O catálogo de referência trata cada estilo como uma cena fechada ("texto impacto", "texto com
 * contorno"). Aqui é um campo: a mesma aparência vale para o hook, para o título e para o selo,
 * e combina com qualquer `anim`/`animOut`. Nove aparências × as entradas = muito mais do que
 * nove cenas prontas dariam.
 */
export const textLook = z.enum([
	"plain",            // como sempre foi — é o padrão, nada muda nos specs antigos
	"impact",           // peso máximo, caixa alta, sombra dura
	"outline_glow",     // contorno aceso em volta da letra
	"translucent_box",  // caixa de vidro fosco atrás
	"chromatic",        // franja vermelha e ciano deslocada
	"glitch",           // a cor pula entre quadros
	"doodle",           // escrito à mão (Caveat)
	"red_word",         // uma palavra em vermelho: marque com *asteriscos*
	"spotlight_off",    // o texto some e sobra um brilho
]);

/** Named animation presets. The spec references behaviour by name, never by raw easing. */
export const animPreset = z.enum([
	"none",
	"pop_in",
	"fade_in",
	"slide_up",
	"punch_in",
	"tilt_scroll",
	"handheld_subtle",
	"shake",
	"zoom_punch",
	"float",
	// Entradas de texto (19/10/2026). Valem em qualquer layer, mas foram desenhadas para texto:
	"typewriter",   // uma letra por vez
	"spring",       // entra passando do ponto e volta
	"twist",        // entra girando no eixo Y
	"exhale",       // abre grande e assenta
	"rising_glow",  // sobe acendendo
]);

export const animOutPreset = z.enum(["none", "fade_out", "pop_out", "slide_down", "wipe_out"]);

export const textPreset = z.enum(["hook_stroke", "sub", "caption", "cta_label", "title_top"]);

/**
 * Entrance effect for a scene's first frames. Never changes total duration or `startMs` —
 * it is purely how the first `transitionMs` of the entering scene render.
 */
export const transitionKind = z.enum(["cut", "fade", "zoom", "whip", "slide_up", "flash"]);

const baseLayer = z.object({
	/** Offset inside the scene; defaults to the scene start. */
	startMs: z.number().int().min(0).optional(),
	durationMs: z.number().int().positive().optional(),
	anim: animPreset.default("none"),
	/**
	 * Como o elemento SAI. Sem isto todo elemento corta seco, que é o que separa um criativo
	 * montado de um criativo editado — nas referências nada desaparece de um quadro para o outro.
	 */
	animOut: animOutPreset.optional(),
});

export const textLayer = baseLayer.extend({
	type: z.literal("text"),
	content: z.string().min(1),
	preset: textPreset.default("sub"),
	/** Aparência. Sem isto, `plain` — nenhum spec antigo muda. */
	look: textLook.optional(),
	/** Cor da palavra marcada com *asteriscos* quando `look` é `red_word`. */
	lookColor: z.string().optional(),
});

/** Generated b-roll (Kie / Higgsfield / fal). `assetId` is the provider task id once the asset exists. */
export const generativeVideoLayer = baseLayer.extend({
	type: z.literal("generative_video"),
	prompt: z.string().min(1),
	provider: z.enum(["kie", "higgsfield", "fal"]).default("kie"),
	assetId: z.string().optional(),
	src: z.string().optional(),
	fit: z.enum(["cover", "contain"]).default("cover"),
	/** Skip this much of the source clip — use a long attached video without pre-cutting it. */
	startFromMs: z.number().int().min(0).default(0),
	/** Desfoque em px — para o clipe virar fundo atrás do mockup, sem roubar a atenção. */
	blur: z.number().min(0).max(80).default(0),
	/** Escurecimento 0..1 por cima do clipe, para o que está na frente ganhar contraste. */
	dim: z.number().min(0).max(1).default(0),
});

/**
 * Footage filmed by a person (a "take"): the creator's own video, with its own sound.
 *
 * This is the UGC edit's raw material — the opposite of `generative_video`. Its audio plays by
 * default because the speech IS the content; a take is trimmed with `startFromMs` and the
 * layer/scene duration, never re-encoded per edit. `takeId` ties it to the transcript the
 * server uses to rebuild the captions after every edit.
 */
export const footageLayer = baseLayer.extend({
	type: z.literal("footage"),
	takeId: z.string().optional(),
	src: z.string().min(1),
	/** In-point inside the take. The out-point is the layer (or scene) duration. */
	startFromMs: z.number().int().min(0).default(0),
	fit: z.enum(["cover", "contain"]).default("cover"),
	/** 0..1 gain of the take's own sound. 0 mutes it (b-roll use of a take). */
	volume: z.number().min(0).max(1).default(1),
	/**
	 * Static punch-in (1 = none). A jump cut between two clips of the same take reads as a
	 * glitch at the same framing and as intentional at 1.1–1.2 — the standard UGC trick.
	 */
	zoom: z.number().min(1).max(1.6).default(1),
	/** Mirror horizontally (front-camera takes are often flipped). */
	mirror: z.boolean().default(false),
});

/** App screen recording, composited inside a device frame. */
export const appScreenLayer = baseLayer.extend({
	type: z.literal("app_screen_recording"),
	assetId: z.string().optional(),
	src: z.string().optional(),
	device: z.enum(["iphone15_mock", "none"]).default("iphone15_mock"),
	/** Skip this much of the recording. Ignored for images. */
	startFromMs: z.number().int().min(0).default(0),
});

export const solidLayer = baseLayer.extend({
	type: z.literal("solid"),
	color: z.string().default("#0B0B0F"),
});

/**
 * Persistent rounded badge at the top (the reference's "SEMANA 1" chip).
 * A structural element of the format, so it is a layer type rather than free-form text —
 * the AI cannot accidentally restyle it per scene.
 */
export const badgeLayer = baseLayer.extend({
	type: z.literal("badge"),
	label: z.string().default(""),
	value: z.string().min(1),
	/** Cor da caixa; sem isto usa o roxo da marca. */
	color: z.string().optional(),
});

/**
 * Karaoke captions: the active word is highlighted in the accent colour.
 *
 * Word timings come from voiceover alignment when a VO exists. Without one, the words are
 * distributed evenly across the layer — an approximation that reads correctly but should
 * be replaced by real alignment before anything is published.
 */
export const karaokeLayer = baseLayer.extend({
	type: z.literal("karaoke"),
	text: z.string().min(1),
	/** Per-word end times in ms, relative to the layer. Optional; even split when absent. */
	wordEndsMs: z.array(z.number().int().positive()).optional(),
	/** Distância do rodapé em % da altura. Padrão alto (perto do centro); baixe quando precisar. */
	bottomPct: z.number().min(5).max(70).optional(),
	/**
	 * Como a palavra falada é destacada. `plain` = só cor (padrão histórico do app);
	 * `box` = caixa cheia atrás da palavra, como nas referências; `pop` = a palavra cresce
	 * no instante em que é dita. A escolha é por cena: fala calma pede `plain`, pico pede `pop`.
	 */
	style: z.enum(["plain", "box", "pop"]).default("plain"),
	/** Corpo da fonte em px (base 1080×1920). Sem isto, 62. Suba no hook, desça no texto corrido. */
	size: z.number().int().min(28).max(130).optional(),
	/** Palavras por tela. Sem isto, 3. */
	maxWords: z.number().int().min(1).max(6).optional(),
	/** Cor da palavra ativa. Sem isto, o accent da marca. */
	activeColor: z.string().optional(),
	/** Palavras que ganham destaque permanente (maiores e coloridas), mesmo sem estarem ativas. */
	emphasis: z.array(z.string()).optional(),
	/**
	 * Written by the server from a take's transcript (not by a person or the model). Auto
	 * captions are thrown away and rebuilt after every edit, so they always match the cut.
	 */
	auto: z.boolean().optional(),
});

/** Small legal line pinned to the bottom ("Dramatização..."). Required in health/fitness ads. */
export const disclaimerLayer = baseLayer.extend({
	type: z.literal("disclaimer"),
	text: z.string().min(1),
});


/**
 * Elemento solto sobre a cena (emoji, seta, selo curto) para dar dinamismo onde não há tela
 * de app — é o que impede o olho de parar no meio do vídeo. Nunca entra por cima do mockup:
 * a tela do app é a prova do produto e não pode ser coberta.
 */
export const stickerLayer = baseLayer.extend({
	type: z.literal("sticker"),
	/** Emoji, seta (→ ← ↑ ↓) ou texto curto. */
	content: z.string().min(1),
	/** Posição em % do quadro, do canto superior esquerdo. */
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(28),
	/** Tamanho em px da fonte do elemento. */
	size: z.number().int().positive().default(180),
	/** Caixa roxa atrás (para selo de texto). */
	chip: z.boolean().default(false),
	/** Cor da caixa (ou do texto, quando `chip` é falso). Sem isto, roxo da marca. */
	color: z.string().optional(),
	/** Cor do texto dentro da caixa. */
	textColor: z.string().optional(),
	/** Emoji ou ícone curto exibido antes do texto, em tamanho maior. */
	icon: z.string().optional(),
	/** Largura máxima em % do quadro — com ela o texto quebra em várias linhas. */
	width: z.number().min(10).max(96).optional(),
	rotate: z.number().min(-45).max(45).default(0),
	/** Aparência do texto do selo. Sem isto, `plain`. */
	look: textLook.optional(),
	lookColor: z.string().optional(),
});


/**
 * Cartão de dado sobre a cena — o vocabulário visual das referências: retângulo de cantos
 * arredondados com um rótulo pequeno, um título em negrito e, às vezes, um número grande.
 * Vive na faixa de cima do quadro; nunca sobre a tela do app.
 */
export const cardLayer = baseLayer.extend({
	type: z.literal("card"),
	/** Rótulo pequeno acima do título (opcional). */
	kicker: z.string().optional(),
	title: z.string().min(1),
	/** Número ou destaque grande embaixo do título (opcional). */
	value: z.string().optional(),
	variant: z.enum(["dark", "light", "accent", "alert", "ok", "warn"]).default("dark"),
	/** Sobrescreve a cor de fundo da variante. */
	color: z.string().optional(),
	/** Centro do cartão em % do quadro. */
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(18),
	/** Largura em % do quadro. */
	width: z.number().min(10).max(96).default(68),
	/** Imagem opcional dentro do cartão (logo, ícone, print). */
	image: z.string().optional(),
	rotate: z.number().min(-20).max(20).default(0),
});


/**
 * Imagem sobre a cena: foto do Pexels, recorte de uma tela do app, logo, ícone.
 *
 * O recorte de tela é feito por `tools/recorte.mjs` e entra aqui como elemento — serve para
 * mostrar UM pedaço do app (o número da dose, o card da refeição) nas cenas em que o mockup
 * inteiro não está em cena. Sobre o mockup, nunca: a tela do app é a prova e não se cobre.
 */
export const imageLayer = baseLayer.extend({
	type: z.literal("image"),
	src: z.string().min(1),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(18),
	/** Largura em % do quadro. */
	width: z.number().min(4).max(100).default(26),
	rotate: z.number().min(-20).max(20).default(0),
	/** Cantos arredondados em px. 0 = quadrado (logo/ícone com fundo transparente). */
	radius: z.number().min(0).max(80).default(0),
	/** Moldura em volta — dá a leitura de "recorte", não de imagem colada. */
	border: z.boolean().default(false),
	/** Legenda curta embaixo da imagem. */
	label: z.string().optional(),
	/** Cor da moldura e da legenda. Sem isto, o accent da marca. */
	color: z.string().optional(),
});

/** Barra fixa no topo com slots que vão sendo preenchidos ("3/6"). */
export const hudLayer = baseLayer.extend({
	type: z.literal("hud"),
	label: z.string().min(1),
	slots: z.number().int().min(1).max(10).default(3),
	filled: z.number().int().min(0).max(10).default(0),
	y: z.number().min(0).max(100).default(6),
	x: z.number().min(0).max(100).default(50),
	/** Cor dos slots preenchidos. */
	color: z.string().optional(),
	/** Enche um slot por vez, a cada N ms, em vez de já nascer cheio. */
	fillStaggerMs: z.number().int().min(0).max(2000).optional(),
});

/** Cartão branco com "equação" de blocos: A + B = C. Cada bloco é texto ou imagem. */
export const equationLayer = baseLayer.extend({
	type: z.literal("equation"),
	tiles: z
		.array(
			z.object({
				text: z.string().optional(),
				image: z.string().optional(),
				color: z.string().optional(),
				/** Operador que vem ANTES deste bloco. */
				op: z.enum(["none", "plus", "equals", "arrow"]).default("none"),
			}),
		)
		.min(2)
		.max(5),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(16),
	width: z.number().min(30).max(96).default(74),
});

/** Lista tipo recibo: linhas com valor, podendo vir riscadas em vermelho. */
export const listCardLayer = baseLayer.extend({
	type: z.literal("list_card"),
	title: z.string().optional(),
	items: z
		.array(
			z.object({
				label: z.string().min(1),
				value: z.string().optional(),
				struck: z.boolean().default(false),
				check: z.boolean().default(false),
				/** Emoji/ícone no lugar do check. */
				icon: z.string().optional(),
				/** Cor do check/ícone desta linha. */
				color: z.string().optional(),
			}),
		)
		.min(1)
		.max(6),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(20),
	width: z.number().min(30).max(96).default(72),
	variant: z.enum(["light", "dark"]).default("light"),
	/** Aparece uma linha por vez, a cada N ms — o olho acompanha o que a voz diz. */
	staggerMs: z.number().int().min(0).max(1500).default(0),
	/** Risca a linha `struck` ao vivo, N ms depois dela aparecer. */
	strikeAtMs: z.number().int().min(0).optional(),
});

/**
 * Rabisco desenhado à mão por cima da cena: círculo, seta, sublinhado, X ou colchete.
 * O traço se DESENHA ao longo de `drawMs` — é o elemento que mais aparece nas referências
 * e o que mais afasta o vídeo da cara de template.
 */
export const scribbleLayer = baseLayer.extend({
	type: z.literal("scribble"),
	shape: z.enum(["circle", "arrow", "underline", "cross", "bracket", "zigzag"]).default("circle"),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(50),
	width: z.number().min(5).max(100).default(40),
	height: z.number().min(3).max(100).default(22),
	color: z.string().default("#E53935"),
	/** Espessura do traço em px (base 1080×1920). */
	stroke: z.number().min(4).max(40).default(14),
	/** Tempo que o traço leva para se desenhar. */
	drawMs: z.number().int().min(80).max(3000).default(500),
	rotate: z.number().min(-45).max(45).default(0),
});

/**
 * APONTADOR: o "olha aqui" do criativo.
 *
 * Quase todo criativo nosso mostra a tela do app e precisa dirigir o olho para um ponto dela.
 * Até 19/10/2026 não havia com o quê — o `scribble` (traço à mão) foi reprovado pela equipe.
 * O apontador é limpo, de interface, não rabiscado.
 *
 * Uma layer, dezesseis formas, e elas se combinam com cor, tamanho e as animações de entrada e
 * saída do `baseLayer`. `text` só é usado por `banner` e `number`.
 *
 * Regra de uso: o apontador aponta PARA FORA de si — encoste-o na coisa, não em cima dela. Sobre
 * o mockup do celular não entra nada (ver elementos-playbook.md).
 */
export const pointerLayer = baseLayer.extend({
	type: z.literal("pointer"),
	shape: z.enum([
		"curved_arrow",   // seta curva, a mais usada
		"side_arrow",     // seta reta, entra pela lateral
		"down_arrow",     // seta de cima para baixo, bate e para
		"tap",            // toque: círculo com onda saindo
		"highlighter",    // marca-texto que varre da esquerda
		"underline",      // sublinhado que cresce
		"box",            // retângulo de destaque que se desenha
		"banner",         // faixa com texto e bico apontando
		"number",         // bolha numerada (passo 1, 2, 3)
		"check",          // check verde
		"cross",          // X vermelho
		"exclamation",    // exclamação
		"question",       // interrogação
		"rays",           // raios saindo do ponto
		"spotlight",      // escurece o resto e abre um buraco de luz
		"toggle",         // alternador ligando
	]).default("curved_arrow"),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(50),
	/** Tamanho em % da largura do quadro. */
	size: z.number().min(4).max(100).default(18),
	/** Sem cor, usa o accent da marca. `check` e `cross` têm cor própria. */
	color: z.string().optional(),
	rotate: z.number().min(-180).max(180).default(0),
	/** Texto de `banner` e `number`. */
	text: z.string().optional(),
	/** Tempo que a forma leva para se desenhar/entrar. */
	drawMs: z.number().int().min(80).max(3000).default(420),
});

/**
 * PAINÉIS DE SAÚDE E COMIDA (19/10/2026).
 *
 * Seis layers que o OzemPro usa toda hora e que o vocabulário não tinha: onde se aplica, o que
 * se come, o que trocar, quanto é demais, e os sinais de alerta. Todas desenhadas pelo renderer
 * — nada de imagem generativa, que erra letra e número.
 *
 * Como sempre: ficam numa faixa livre do quadro e nunca sobre o mockup do celular.
 */

/** Corpo visto de frente com os pontos de aplicação; o ponto escolhido acende. */
export const bodyMapLayer = baseLayer.extend({
	type: z.literal("body_map"),
	/**
	 * Pontos acesos. `abdomen_*` são os da bula; `thigh`/`arm` completam.
	 *
	 * Esquerda e direita seguem a tela do app, não a anatomia: `_r` acende do lado direito de
	 * quem assiste, igual ao seletor "Abdomen Inf. Der." do OzemPro. Não "corrigir" para o lado
	 * do paciente — ia desencontrar do produto.
	 */
	spots: z
		.array(z.enum(["abdomen_ul", "abdomen_ur", "abdomen_ll", "abdomen_lr", "thigh_l", "thigh_r", "arm_l", "arm_r"]))
		.default([]),
	/** Texto curto abaixo do corpo (ex.: "abdômen inferior direito"). */
	label: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(45),
	width: z.number().min(15).max(90).default(46),
	color: z.string().optional(),
	/** Tempo até o ponto acender. */
	drawMs: z.number().int().min(100).max(3000).default(600),
});

/** Prato dividido em fatias, cada uma com nome e proporção — "metade legume, um quarto proteína". */
export const plateLayer = baseLayer.extend({
	type: z.literal("plate"),
	slices: z
		.array(z.object({ label: z.string(), percent: z.number().min(1).max(100), color: z.string().optional() }))
		.min(2)
		.max(5),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(42),
	width: z.number().min(20).max(90).default(56),
	drawMs: z.number().int().min(150).max(3000).default(800),
});

/** Troca: isto sai, aquilo entra. Dois cartões e uma seta no meio. */
export const swapLayer = baseLayer.extend({
	type: z.literal("swap"),
	fromLabel: z.string(),
	toLabel: z.string(),
	fromIcon: z.string().optional(),
	toIcon: z.string().optional(),
	/** Texto pequeno sob a seta (ex.: "−180 kcal"). */
	note: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(45),
	width: z.number().min(40).max(96).default(84),
	drawMs: z.number().int().min(150).max(3000).default(700),
});

/** Grade de unidades que aparecem uma a uma — "são 12 cubos de açúcar nisso aqui". */
export const unitsLayer = baseLayer.extend({
	type: z.literal("units"),
	count: z.number().int().min(1).max(60),
	shape: z.enum(["cube", "circle", "drop", "pill"]).default("cube"),
	label: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(42),
	width: z.number().min(20).max(92).default(62),
	color: z.string().optional(),
	/** Tempo até a última unidade aparecer. */
	drawMs: z.number().int().min(200).max(5000).default(1200),
});

/** Medidor com faixa de limite: o ponteiro anda e para — verde, amarelo, vermelho. */
export const limitGaugeLayer = baseLayer.extend({
	type: z.literal("limit_gauge"),
	value: z.number().min(0).max(100),
	limit: z.number().min(0).max(100).default(70),
	label: z.string().optional(),
	valueText: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(40),
	width: z.number().min(25).max(92).default(60),
	drawMs: z.number().int().min(150).max(3000).default(900),
});

/** Lista de sinais de alerta, cada um com seu ícone, entrando em sequência. */
export const warningSignsLayer = baseLayer.extend({
	type: z.literal("warning_signs"),
	title: z.string().optional(),
	items: z.array(z.object({ icon: z.string().optional(), text: z.string() })).min(1).max(6),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(45),
	width: z.number().min(40).max(94).default(80),
	color: z.string().optional(),
	/** Intervalo entre um item e o seguinte. */
	staggerMs: z.number().int().min(60).max(1200).default(220),
});

/** Número que sobe (ou desce) de `from` a `to` — "contador" do vocabulário das referências. */
export const counterLayer = baseLayer.extend({
	type: z.literal("counter"),
	from: z.number().default(0),
	to: z.number(),
	/** Casas decimais. */
	decimals: z.number().int().min(0).max(2).default(0),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	label: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(30),
	size: z.number().int().min(40).max(260).default(140),
	color: z.string().optional(),
	/** Caixa atrás do número. */
	chip: z.boolean().default(true),
	countMs: z.number().int().min(150).max(4000).default(900),
});

/** Barra que cresce até `value`% — progresso, meta batida, comparação. */
export const barLayer = baseLayer.extend({
	type: z.literal("bar"),
	label: z.string().optional(),
	value: z.number().min(0).max(100),
	valueText: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(30),
	width: z.number().min(20).max(96).default(66),
	color: z.string().optional(),
	growMs: z.number().int().min(150).max(3000).default(700),
});

/** Gráfico de linha que se desenha. `flat: true` mantém a linha reta — o platô. */
export const lineChartLayer = baseLayer.extend({
	type: z.literal("line_chart"),
	/** Valores 0..100 (0 = base). Dois pontos ou mais. */
	points: z.array(z.number().min(0).max(100)).min(2).max(12),
	label: z.string().optional(),
	endLabel: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(30),
	width: z.number().min(20).max(96).default(62),
	height: z.number().min(8).max(50).default(22),
	color: z.string().optional(),
	drawMs: z.number().int().min(150).max(4000).default(800),
});

/**
 * Régua de seringa desenhada: os traços numerados, com uma faixa acesa no intervalo da dose.
 *
 * É o assunto do criativo de fracionamento virando imagem. Os números são desenhados pelo
 * renderer (nunca saem tortos como em imagem generativa) e a faixa cresce para o olho ir até
 * ela. Vive numa faixa livre do quadro, perto da mão que segura a seringa — nunca sobre o
 * mockup do app.
 */
export const syringeRulerLayer = baseLayer.extend({
	type: z.literal("syringe_ruler"),
	/** Começo e fim da escala impressa na seringa (ex.: 0 a 100 UI). */
	from: z.number().default(0),
	to: z.number().default(100),
	/** Distância entre traços pequenos (a seringa de 100 UI costuma ter de 2 em 2). */
	step: z.number().min(0.5).default(2),
	/** Traço com número escrito, de quantos em quantos. */
	labelEvery: z.number().min(1).default(10),
	/** Intervalo que acende. Sem isto, a régua aparece sem destaque. */
	highlightFrom: z.number().optional(),
	highlightTo: z.number().optional(),
	/** Texto curto acima da faixa acesa (ex.: "puxe até 25"). */
	label: z.string().optional(),
	x: z.number().min(0).max(100).default(50),
	y: z.number().min(0).max(100).default(86),
	width: z.number().min(30).max(96).default(84),
	color: z.string().optional(),
	/** Tempo que a faixa leva para crescer até o intervalo. */
	drawMs: z.number().int().min(80).max(3000).default(520),
});

export const layer = z.discriminatedUnion("type", [
	syringeRulerLayer,
	scribbleLayer,
	pointerLayer,
	bodyMapLayer,
	plateLayer,
	swapLayer,
	unitsLayer,
	limitGaugeLayer,
	warningSignsLayer,
	counterLayer,
	barLayer,
	lineChartLayer,
	textLayer,
	generativeVideoLayer,
	footageLayer,
	appScreenLayer,
	solidLayer,
	badgeLayer,
	stickerLayer,
	cardLayer,
	imageLayer,
	hudLayer,
	equationLayer,
	listCardLayer,
	karaokeLayer,
	disclaimerLayer,
]);

export const scene = z.object({
	id: z.string().min(1),
	role: sceneRole,
	startMs: z.number().int().min(0),
	durationMs: z.number().int().positive(),
	/**
	 * "locked" scenes must keep their duration (they sync to a cut or a UI animation);
	 * "flex" scenes absorb timing differences — which is how a locale swap survives a
	 * voiceover that runs 20% longer in PT than in EN.
	 */
	timing: z.enum(["locked", "flex"]).default("flex"),
	/** How this scene enters. The first scene always ignores it (nothing to transition from). */
	transitionIn: transitionKind.default("cut"),
	/** Length of the entrance effect in ms — bounded so it can never eat a whole short scene. */
	transitionMs: z.number().int().min(80).max(600).default(250),
	layers: z.array(layer).min(1),
});

const BRAND_DEFAULTS = {
	bg: "#0B0B0F",
	fg: "#FFFFFF",
	accent: "#6C5CE7",
	fontFamily: "Inter, system-ui, sans-serif",
};

/**
 * Audio track. `src` is either an absolute URL or a path inside `public/`.
 *
 * Ducking is expressed in dB below the music's own gain, applied only while the voiceover
 * is speaking — a fixed low music volume either buries the track or fights the voice, and
 * getting this wrong is the fastest way to make an ad feel amateur.
 */
export const audioTrack = z.object({
	src: z.string().min(1),
	/** 0..1 linear gain. */
	volume: z.number().min(0).max(1).default(1),
	/** Skip this much of the source file before playing. */
	startFromMs: z.number().int().min(0).default(0),
});

export const specAudio = z.object({
	voiceover: audioTrack
		.extend({
			/** The script, kept for regeneration and for caption alignment. */
			script: z.string().optional(),
			voiceId: z.string().optional(),
			provider: z.enum(["kie", "higgsfield", "elevenlabs"]).optional(),
			/** When the voiceover starts on the timeline. */
			atMs: z.number().int().min(0).default(0),
			/**
			 * How long it lasts. Drives when the music comes back up — without it the music
			 * would stay ducked to the end of the video, long after the voice stopped.
			 */
			durationMs: z.number().int().positive().optional(),
		})
		.optional(),
	music: audioTrack
		.extend({
			/** dB to drop the music while the voiceover plays. Negative. */
			duckingDb: z.number().max(0).default(-14),
		})
		.optional(),
	/** One-shot effects (cut whooshes, UI pops) placed at absolute timeline positions. */
	sfx: z
		.array(
			z.object({
				src: z.string().min(1),
				atMs: z.number().int().min(0),
				volume: z.number().min(0).max(1).default(0.6),
			}),
		)
		.optional(),
});

export const brandKit = z.object({
	bg: z.string().default(BRAND_DEFAULTS.bg),
	fg: z.string().default(BRAND_DEFAULTS.fg),
	accent: z.string().default(BRAND_DEFAULTS.accent),
	fontFamily: z.string().default(BRAND_DEFAULTS.fontFamily),
});

export const creativeSpec = z.object({
	specVersion: z.literal("1"),
	creativeId: z.string().min(1),
	appId: z.string().min(1),
	locale: z.string().default("pt-BR"),
	lineage: z
		.object({ parentId: z.string().optional(), mutation: z.string().optional() })
		.optional(),
	output: z.object({ kind: z.enum(["video", "image", "carousel"]).default("video") }).default({
		kind: "video",
	}),
	format: z.object({
		w: z.number().int().positive().default(1080),
		h: z.number().int().positive().default(1920),
		fps: z.number().int().positive().default(30),
	}),
	brandKit: brandKit.default(BRAND_DEFAULTS),
	audio: specAudio.optional(),
	/**
	 * Captions from the takes' real speech: the server splits each footage clip's words into
	 * short blocks (auto karaoke layers) with exact word timings. Off = no auto captions.
	 */
	autoCaptions: z
		.object({
			enabled: z.boolean().default(true),
			/** Words per caption block. 3–4 reads at a glance; more becomes a paragraph. */
			maxWords: z.number().int().min(1).max(8).default(4),
		})
		.optional(),
	scenes: z.array(scene).min(1),
});

export type CreativeSpec = z.infer<typeof creativeSpec>;
export type Scene = z.infer<typeof scene>;
export type Layer = z.infer<typeof layer>;
export type TextLook = z.infer<typeof textLook>;
export type BrandKit = z.infer<typeof brandKit>;
export type TextPreset = z.infer<typeof textPreset>;
export type SpecAudio = z.infer<typeof specAudio>;
export type TransitionKind = z.infer<typeof transitionKind>;

/** dB attenuation as a linear multiplier, for mixing. */
export function dbToGain(db: number): number {
	return Math.pow(10, db / 20);
}

/** Total duration derived from the scenes — the spec never states it twice. */
export function specDurationMs(spec: CreativeSpec): number {
	return spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
}

export function msToFrames(ms: number, fps: number): number {
	return Math.max(1, Math.round((ms / 1000) * fps));
}

/**
 * Where something STARTS on the timeline. Unlike a duration it can be 0 — `msToFrames` clamps
 * to 1, which pushed every opening scene to frame 1 and left frame 0 as an empty background
 * (a black first frame, which Instagram uses as the default Reels cover).
 */
export function msToStartFrame(ms: number, fps: number): number {
	return Math.max(0, Math.round((ms / 1000) * fps));
}
