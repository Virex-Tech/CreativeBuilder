import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";

import { layoutFor, type Layout } from "../formats";
import { useMediaAspect } from "./mediaAspect";
import { BADGE_TOP, badgeHeight, resolveAnim, resolveExit, resolveTextPreset, TOP_STACK_GAP } from "../presets/anims";
import { resolveSrc } from "../resolveSrc";
import { msToFrames, type BrandKit, type Layer, type TextLook } from "../spec";

interface Props {
	layer: Layer;
	brand: BrandKit;
	durationInFrames: number;
	/**
	 * Set on a `title_top` text that shares the screen with a `badge` (same scene, overlapping
	 * time): the title goes below the badge. `badgeWithLabel` picks the badge's height.
	 */
	belowBadge?: { badgeWithLabel: boolean };
}

/**
 * Renders one layer of a scene.
 *
 * Everything textual and structural lives HERE, in the deterministic layer — never in a
 * generative model. Models misspell words and mangle UI, and a single wrong letter is what
 * makes an ad read as AI slop. The generative providers only supply moving imagery.
 */
export const LayerRenderer: React.FC<Props> = ({ layer, brand, durationInFrames, belowBadge }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const entrada = resolveAnim(layer.anim, frame, fps, durationInFrames);
	const saida = resolveExit(layer.animOut, frame, fps, durationInFrames);
	// Entrada e saída se multiplicam: o elemento nasce e morre, em vez de piscar.
	const anim = {
		opacity: entrada.opacity * saida.opacity,
		scale: entrada.scale * saida.scale,
		translateY: entrada.translateY + saida.translateY,
		rotateY: (entrada.rotateY ?? 0) + (saida.rotateY ?? 0),
	};
	const msDaLayer = (frame / fps) * 1000;
	// Every px below is in base 1080×1920 px, scaled to the composition (identity at 9:16).
	const L = layoutFor(width, height);
	const z = L.size;

	const transform = `perspective(1200px) rotateY(${anim.rotateY ?? 0}deg) scale(${anim.scale}) translateY(${anim.translateY}px)`;

	switch (layer.type) {
		case "syringe_ruler":
			return <SyringeRuler layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "scribble":
			return <Scribble layer={layer} ms={msDaLayer} opacity={anim.opacity} />;

		case "pointer":
			return <Pointer layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "body_map":
			return <BodyMap layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "plate":
			return <Plate layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "swap":
			return <Swap layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "units":
			return <Units layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "limit_gauge":
			return <LimitGauge layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "warning_signs":
			return <WarningSigns layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "counter":
			return <Counter layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "bar":
			return <Bar layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "line_chart":
			return <LineChart layer={layer} brand={brand} ms={msDaLayer} anim={anim} />;

		case "solid":
			return <AbsoluteFill style={{ backgroundColor: layer.color, opacity: anim.opacity }} />;

		case "text": {
			const style = resolveTextPreset(layer.preset, brand, L);
			if (belowBadge && layer.preset === "title_top") {
				const underBadge = L.top(BADGE_TOP) + z(badgeHeight(belowBadge.badgeWithLabel) + TOP_STACK_GAP);
				style.top = Math.max(style.top ?? 0, underBadge);
			}

			return (
				<AbsoluteFill
					style={{
						justifyContent: style.top !== undefined ? "flex-start" : style.bottom === undefined ? "center" : "flex-end",
						alignItems: "center",
						padding: `0 ${L.x(60)}px`,
						paddingBottom: style.bottom,
						paddingTop: style.top,
						opacity: anim.opacity,
						transform,
					}}
				>
					<div
						style={{
							fontFamily: brand.fontFamily,
							fontSize: style.fontSize,
							fontWeight: style.fontWeight,
							lineHeight: style.lineHeight,
							color: style.color,
							textShadow: style.textShadow,
							maxWidth: style.maxWidth,
							textAlign: style.textAlign,
							background: style.background,
							padding: style.padding,
							borderRadius: style.borderRadius,
							boxShadow: style.boxShadow,
							// Long locales (PT/ES run 20-30% longer than EN) must shrink, not overflow.
							overflowWrap: "break-word",
							...estiloDaAparencia(layer.look, brand, style.fontSize ?? 60, msDaLayer),
						}}
					>
						<TextoComAparencia
							conteudo={layer.content}
							look={layer.look}
							lookColor={layer.lookColor}
							anim={layer.anim}
							brand={brand}
							ms={msDaLayer}
							durationMs={(durationInFrames / fps) * 1000}
						/>
					</div>
				</AbsoluteFill>
			);
		}

		case "generative_video":
			// Without a resolved asset the spec is still a draft: show the prompt so a preview
			// render is readable instead of silently black.
			return layer.src ? (
				<AbsoluteFill style={{ opacity: anim.opacity, transform }}>
					<OffthreadVideo
						src={resolveSrc(layer.src)}
						trimBefore={layer.startFromMs ? msToFrames(layer.startFromMs, fps) : undefined}
						style={{
							width: "100%",
							height: "100%",
							objectFit: layer.fit,
							// Desfoque + escurecimento transformam o clipe em fundo vivo atrás do
							// mockup: a cena continua se mexendo sem disputar com a tela do app.
							filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
							transform: layer.blur ? "scale(1.12)" : undefined,
						}}
					/>
					{layer.dim ? (
						<AbsoluteFill style={{ background: `rgba(10,5,20,${layer.dim})` }} />
					) : null}
				</AbsoluteFill>
			) : (
				<PlaceholderLayer
					brand={brand}
					label="b-roll"
					detail={layer.prompt}
					opacity={anim.opacity}
					layout={L}
				/>
			);

		case "footage":
			return (
				<AbsoluteFill style={{ opacity: anim.opacity, transform, overflow: "hidden" }}>
					<OffthreadVideo
						src={resolveSrc(layer.src)}
						trimBefore={layer.startFromMs ? msToFrames(layer.startFromMs, fps) : undefined}
						volume={layer.volume}
						muted={layer.volume === 0}
						style={{
							width: "100%",
							height: "100%",
							objectFit: layer.fit,
							transform: `scale(${layer.mirror ? -layer.zoom : layer.zoom}, ${layer.zoom})`,
						}}
					/>
				</AbsoluteFill>
			);

		case "app_screen_recording":
			// Keyed by src: the size probe (and its render hold) belongs to one media file.
			return (
				<AppScreen
					key={layer.src ?? "placeholder"}
					layer={layer}
					brand={brand}
					layout={L}
					durationInFrames={durationInFrames}
					opacity={anim.opacity}
					transform={transform}
				/>
			);

		case "badge":
			return (
				<AbsoluteFill
					style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: L.top(BADGE_TOP) }}
				>
					<div
						style={{
							background: layer.color ?? "rgba(10,10,12,0.88)",
							borderRadius: z(36),
							padding: `${z(22)}px ${z(54)}px`,
							textAlign: "center",
							fontFamily: brand.fontFamily,
							transform: `scale(${anim.scale})`,
							opacity: anim.opacity,
						}}
					>
						{layer.label ? (
							<div
								style={{
									fontSize: z(34),
									fontWeight: 700,
									letterSpacing: z(6),
									color: brand.fg,
									opacity: 0.9,
								}}
							>
								{layer.label.toUpperCase()}
							</div>
						) : null}
						<div
							style={{
								fontSize: z(84),
								fontWeight: 900,
								lineHeight: 1,
								color: layer.color ? "#FFFFFF" : brand.accent,
								marginTop: layer.label ? z(6) : 0,
							}}
						>
							{layer.value}
						</div>
					</div>
				</AbsoluteFill>
			);

		case "karaoke":
			return <Karaoke layer={layer} brand={brand} durationInFrames={durationInFrames} layout={L} />;

		case "image": {
			const cor = layer.color ?? brand.accent;

			return (
				<AbsoluteFill>
					<div
						style={{
							position: "absolute",
							left: `${layer.x}%`,
							top: `${layer.y}%`,
							width: `${layer.width}%`,
							transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale}) translateY(${anim.translateY}px)`,
							opacity: anim.opacity,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 12,
						}}
					>
						<Img
							src={resolveSrc(layer.src)}
							style={{
								width: "100%",
								display: "block",
								borderRadius: layer.radius,
								border: layer.border ? `6px solid ${cor}` : "none",
								boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
							}}
						/>
						{layer.label ? (
							<div
								style={{
									background: cor,
									color: "#FFFFFF",
									borderRadius: 18,
									padding: "10px 22px 14px",
									fontFamily: `Montserrat, ${brand.fontFamily}`,
									fontSize: 34,
									fontWeight: 800,
									textTransform: "uppercase",
									letterSpacing: "0.04em",
									whiteSpace: "nowrap",
									boxShadow: "0 10px 26px rgba(0,0,0,0.4)",
								}}
							>
								{layer.label}
							</div>
						) : null}
					</div>
				</AbsoluteFill>
			);
		}

		case "hud": {
			// Barra com slots que enchem — o "0/6" das referências. Dá sensação de progresso sem
			// precisar narrar o progresso. Com `fillStaggerMs` os slots acendem um a um.
			const cheios = layer.fillStaggerMs
				? Math.max(0, Math.min(layer.filled, Math.floor(msDaLayer / layer.fillStaggerMs) + 1))
				: layer.filled;
			return (
				<AbsoluteFill style={{ opacity: anim.opacity }}>
					<div
						style={{
							position: "absolute",
							top: `${layer.y}%`,
							left: `${layer.x}%`,
							transform: "translateX(-50%)",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 12,
							fontFamily: `Montserrat, ${brand.fontFamily}`,
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 14,
								background: "rgba(10,6,18,0.88)",
								borderRadius: 999,
								padding: "12px 24px",
								color: "#FFFFFF",
								fontSize: 38,
								fontWeight: 800,
								letterSpacing: "0.02em",
							}}
						>
							<span>{layer.label}</span>
							<span style={{ color: layer.color ?? brand.accent }}>{`${cheios}/${layer.slots}`}</span>
						</div>
						<div style={{ display: "flex", gap: 10 }}>
							{Array.from({ length: layer.slots }).map((_, i) => {
								const aceso = i < cheios;
								const cor = layer.color ?? brand.accent;
								return (
									<div
										key={`slot-${String(i)}`}
										style={{
											width: 72,
											height: 72,
											borderRadius: 20,
											background: aceso ? cor : "rgba(255,255,255,0.22)",
											border: `3px solid ${aceso ? cor : "rgba(255,255,255,0.45)"}`,
											boxShadow: aceso ? `0 8px 20px ${cor}66` : "none",
											// o slot que acabou de acender dá um pulinho
											transform: `scale(${aceso && layer.fillStaggerMs && msDaLayer - i * layer.fillStaggerMs < 160 ? 1.18 : 1})`,
										}}
									/>
								);
							})}
						</div>
					</div>
				</AbsoluteFill>
			);
		}

		case "equation": {
			const operador = { none: "", plus: "+", equals: "=", arrow: "→" };
			return (
				<AbsoluteFill>
					<div
						style={{
							position: "absolute",
							left: `${layer.x}%`,
							top: `${layer.y}%`,
							width: `${layer.width}%`,
							transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
							opacity: anim.opacity,
							background: "#FFFFFF",
							borderRadius: 36,
							padding: "26px 30px",
							boxShadow: "0 26px 60px rgba(0,0,0,0.45)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 18,
							fontFamily: `Montserrat, ${brand.fontFamily}`,
						}}
					>
						{layer.tiles.map((t, i) => (
							<React.Fragment key={`tile-${String(i)}`}>
								{t.op !== "none" ? (
									<span style={{ fontSize: 64, fontWeight: 800, color: "#12091F" }}>
										{operador[t.op]}
									</span>
								) : null}
								<div
									style={{
										minWidth: 168,
										height: 168,
										borderRadius: 30,
										background: t.color ?? "#F2ECFB",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										padding: 10,
										color: "#12091F",
										fontSize: 52,
										fontWeight: 800,
										textAlign: "center",
										lineHeight: 1.05,
										overflow: "hidden",
									}}
								>
									{t.image ? (
										<Img
											src={resolveSrc(t.image)}
											style={{ width: "100%", height: "100%", objectFit: "contain" }}
										/>
									) : (
										t.text
									)}
								</div>
							</React.Fragment>
						))}
					</div>
				</AbsoluteFill>
			);
		}

		case "list_card": {
			const escuro = layer.variant === "dark";
			const entrouLinha = (i: number) =>
				!layer.staggerMs || msDaLayer >= i * layer.staggerMs;
			const riscou = layer.strikeAtMs === undefined || msDaLayer >= layer.strikeAtMs;
			const larguraRisco =
				layer.strikeAtMs === undefined
					? 100
					: Math.min(100, Math.max(0, ((msDaLayer - layer.strikeAtMs) / 260) * 100));
			return (
				<AbsoluteFill>
					<div
						style={{
							position: "absolute",
							left: `${layer.x}%`,
							top: `${layer.y}%`,
							width: `${layer.width}%`,
							transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
							opacity: anim.opacity,
							background: escuro ? "rgba(14,8,24,0.93)" : "#FFFFFF",
							borderRadius: 30,
							padding: "26px 30px 30px",
							boxShadow: "0 26px 60px rgba(0,0,0,0.45)",
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							color: escuro ? "#FFFFFF" : "#12091F",
						}}
					>
						{layer.title ? (
							<div
								style={{
									fontSize: 34,
									fontWeight: 800,
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									marginBottom: 16,
									color: escuro ? "rgba(255,255,255,0.6)" : "#5B5668",
								}}
							>
								{layer.title}
							</div>
						) : null}
						{layer.items.map((it, i) => (
							<div
								key={`item-${String(i)}`}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 18,
									padding: "10px 0",
									borderBottom:
										i < layer.items.length - 1
											? `2px solid ${escuro ? "rgba(255,255,255,0.12)" : "#EFE9F7"}`
											: "none",
									position: "relative",
									// uma linha por vez, no ritmo da fala
									opacity: entrouLinha(i) ? 1 : 0,
									transform: entrouLinha(i) ? "none" : "translateY(14px)",
								}}
							>
								<span style={{ fontSize: 50, fontWeight: 700 }}>
									{it.icon ? (
										<span style={{ color: it.color ?? undefined }}>{it.icon} </span>
									) : it.check ? (
										<span style={{ color: it.color ?? "#1FA84F" }}>✓ </span>
									) : null}
									{it.label}
								</span>
								{it.value ? (
									<span
										style={{
											fontSize: 50,
											fontWeight: 800,
											color: it.color ?? (escuro ? "rgba(255,255,255,0.65)" : "#5B5668"),
										}}
									>
										{it.value}
									</span>
								) : null}
								{it.struck && riscou ? (
									<div
										style={{
											position: "absolute",
											left: -6,
											right: -6,
											top: "52%",
											height: 6,
											borderRadius: 4,
											background: "#E53935",
											// o risco corre da esquerda para a direita, não aparece pronto
											width: `${larguraRisco}%`,
											transform: "rotate(-1.2deg)",
										}}
									/>
								) : null}
							</div>
						))}
					</div>
				</AbsoluteFill>
			);
		}

		case "card": {
			let paleta = {
				dark: { fundo: "rgba(18,9,31,0.92)", texto: "#FFFFFF", rotulo: brand.accent },
				light: { fundo: "rgba(255,255,255,0.96)", texto: "#12091F", rotulo: brand.accent },
				accent: { fundo: brand.accent, texto: "#FFFFFF", rotulo: "rgba(255,255,255,0.75)" },
				alert: { fundo: "#C62828", texto: "#FFFFFF", rotulo: "rgba(255,255,255,0.8)" },
				ok: { fundo: "#1FA84F", texto: "#FFFFFF", rotulo: "rgba(255,255,255,0.8)" },
				warn: { fundo: "#FFD600", texto: "#12091F", rotulo: "rgba(18,9,31,0.65)" },
			}[layer.variant] ?? { fundo: "rgba(18,9,31,0.92)", texto: "#FFFFFF", rotulo: brand.accent };
			// `color` no spec vence a variante: é o que destrava a gramática de cor do playbook.
			if (layer.color) paleta = { ...paleta, fundo: layer.color };

			return (
				<AbsoluteFill>
					<div
						style={{
							position: "absolute",
							left: `${layer.x}%`,
							top: `${layer.y}%`,
							width: `${layer.width}%`,
							transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale}) translateY(${anim.translateY}px)`,
							opacity: anim.opacity,
							background: paleta.fundo,
							color: paleta.texto,
							borderRadius: 32,
							padding: "28px 34px 32px",
							boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							display: "flex",
							flexDirection: "column",
							gap: 10,
							alignItems: "flex-start",
						}}
					>
						{layer.kicker ? (
							<div
								style={{
									fontSize: 26,
									fontWeight: 700,
									letterSpacing: "0.12em",
									textTransform: "uppercase",
									color: paleta.rotulo,
								}}
							>
								{layer.kicker}
							</div>
						) : null}
						<div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.12 }}>{layer.title}</div>
						{layer.value ? (
							<div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1 }}>{layer.value}</div>
						) : null}
						{layer.image ? (
							<Img
								src={resolveSrc(layer.image)}
								style={{ width: "100%", marginTop: 6, objectFit: "contain" }}
							/>
						) : null}
					</div>
				</AbsoluteFill>
			);
		}

		case "sticker": {
			// Fica fora do mockup por construção: quem posiciona é o spec, e a regra do projeto
			// é não usar sticker em cena que tem tela de app.
			const base: React.CSSProperties = {
				position: "absolute",
				left: `${layer.x}%`,
				top: `${layer.y}%`,
				transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale}) translateY(${anim.translateY}px)`,
				opacity: anim.opacity,
				fontSize: layer.size,
				fontFamily: `Montserrat, ${brand.fontFamily}`,
				fontWeight: 800,
				color: layer.textColor ?? (layer.chip ? brand.fg : (layer.color ?? brand.fg)),
				whiteSpace: layer.width ? "normal" : "nowrap",
				width: layer.width ? `${layer.width}%` : undefined,
				boxSizing: "border-box" as const,
				textAlign: "center",
				lineHeight: 1.12,
			};
			const comChip: React.CSSProperties = layer.chip
				? {
						background: layer.color ?? brand.accent,
						borderRadius: 28,
						padding: "20px 34px 26px",
						boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
						textTransform: "uppercase",
					}
				: { textShadow: "0 6px 24px rgba(0,0,0,0.55)" };

			return (
				<AbsoluteFill>
					<div style={{ ...base, ...comChip, ...estiloDaAparencia(layer.look, brand, layer.size, msDaLayer) }}>
						{layer.icon ? (
							<span style={{ fontSize: layer.size * 1.25, marginRight: 12, verticalAlign: "-0.1em" }}>
								{layer.icon}
							</span>
						) : null}
						<TextoComAparencia
							conteudo={layer.content}
							look={layer.look}
							lookColor={layer.lookColor}
							anim={layer.anim}
							brand={brand}
							ms={msDaLayer}
							durationMs={(durationInFrames / fps) * 1000}
						/>
					</div>
				</AbsoluteFill>
			);
		}

		case "disclaimer":
			return (
				<AbsoluteFill
					style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: L.bottom(350) }}
				>
					<div
						style={{
							fontFamily: brand.fontFamily,
							fontSize: z(22),
							fontWeight: 600,
							color: brand.fg,
							opacity: 0.85,
							textShadow: `0 ${z(2)}px ${z(8)}px rgba(0,0,0,0.9)`,
							textAlign: "center",
							maxWidth: "88%",
						}}
					>
						{layer.text}
					</div>
				</AbsoluteFill>
			);

		default:
			return null;
	}
};

/**
 * Word-by-word highlight. The active word takes the accent colour, which is what makes the
 * caption readable with the sound off — the eye tracks the highlight instead of re-reading
 * the whole line on every frame.
 */
/** Suaviza 0..1 — mesma curva para tudo que "se desenha". */
const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

/**
 * Traço desenhado à mão por cima da cena.
 *
 * O caminho usa pathLength={1} + dashoffset, então o traço nasce da ponta e corre até o fim —
 * é isso que lê como "alguém marcou agora", e não como adesivo colado.
 */
const Scribble: React.FC<{
	layer: Extract<Layer, { type: "scribble" }>;
	ms: number;
	opacity: number;
}> = ({ layer, ms, opacity }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	// Cada forma é uma lista de traços, desenhados em sequência (a ponta da seta vem depois).
	const formas: Record<string, string[]> = {
		circle: ["M50 8 C78 6 95 26 94 50 C93 76 72 94 48 94 C25 94 6 75 7 50 C8 27 26 9 56 7"],
		underline: ["M4 62 C28 50 68 76 96 58"],
		arrow: ["M6 84 C34 74 58 44 86 20", "M86 20 L64 24", "M86 20 L82 44"],
		cross: ["M14 14 L86 86", "M86 14 L14 86"],
		bracket: ["M28 6 L8 6 L8 94 L28 94"],
		zigzag: ["M4 70 L24 34 L44 70 L64 34 L84 70 L96 48"],
	};
	const tracos = formas[layer.shape] ?? formas.circle;
	const fatia = 1 / tracos.length;

	return (
		<AbsoluteFill style={{ opacity }}>
			<svg
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					height: `${layer.height}%`,
					transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
					overflow: "visible",
					filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))",
				}}
			>
				{tracos.map((d, i) => {
					const local = Math.max(0, Math.min(1, (p - i * fatia) / fatia));
					return (
						<path
							key={`t-${String(i)}`}
							d={d}
							pathLength={1}
							fill="none"
							stroke={layer.color}
							strokeWidth={layer.stroke}
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
							strokeDasharray={1}
							strokeDashoffset={1 - local}
						/>
					);
				})}
			</svg>
		</AbsoluteFill>
	);
};

/**
 * APARÊNCIA DO TEXTO — `look`, separado da animação.
 *
 * Nas referências cada estilo é uma cena fechada ("texto impacto", "texto com contorno"). Aqui é
 * um campo: a mesma aparência serve ao hook, ao título e ao selo, e combina com qualquer `anim`.
 * `plain` (ou sem `look`) devolve o que sempre foi, então nenhum spec antigo muda.
 */
function estiloDaAparencia(
	look: TextLook | undefined,
	brand: BrandKit,
	tamanho: number,
	ms: number,
): React.CSSProperties {
	const contorno = brand.accent;
	switch (look) {
		case "impact":
			return {
				fontWeight: 900,
				textTransform: "uppercase",
				letterSpacing: "-0.02em",
				lineHeight: 1.02,
				textShadow: "0 8px 0 rgba(0,0,0,0.55), 0 18px 40px rgba(0,0,0,0.5)",
			};
		case "outline_glow":
			return {
				WebkitTextStroke: `${Math.max(2, tamanho * 0.035)}px ${contorno}`,
				textShadow: `0 0 ${tamanho * 0.3}px ${contorno}, 0 0 ${tamanho * 0.7}px ${contorno}`,
			};
		case "translucent_box":
			return {
				background: "rgba(255,255,255,0.14)",
				backdropFilter: "blur(10px)",
				WebkitBackdropFilter: "blur(10px)",
				border: "1px solid rgba(255,255,255,0.26)",
				borderRadius: 22,
				padding: "0.34em 0.6em",
			};
		case "chromatic":
			// Franja vermelha e ciano, como impressão fora de registro.
			return { textShadow: `0.035em 0 0 #FF2D55, -0.035em 0 0 #00E5FF, 0 8px 28px rgba(0,0,0,0.5)` };
		case "glitch": {
			// A cor pula entre quadros — o passo é o quadro, então o salto é seco.
			const q = Math.floor(ms / 33.3);
			const salto = [0, 1, 0, 2, 0, 0, 1][q % 7];
			return {
				textShadow:
					salto === 1
						? "0.05em 0 0 #FF2D55, -0.05em 0 0 #00E5FF"
						: salto === 2
							? "-0.06em 0 0 #FF2D55, 0.06em 0 0 #00E5FF"
							: "0 6px 24px rgba(0,0,0,0.55)",
				transform: salto ? `translateX(${salto === 1 ? 3 : -3}px)` : undefined,
			};
		}
		case "doodle":
			return { fontFamily: "Caveat, 'Comic Sans MS', cursive", fontWeight: 700, letterSpacing: "0.01em" };
		case "spotlight_off":
			return { color: "transparent", textShadow: `0 0 ${tamanho * 0.45}px rgba(255,255,255,0.9)` };
		case "red_word":
		case "plain":
		default:
			return {};
	}
}

/**
 * Texto já com a aparência aplicada.
 *
 * Dois casos precisam mexer no conteúdo, não só no CSS:
 *   `red_word`  — a palavra entre *asteriscos* sai colorida;
 *   `typewriter` — as letras aparecem uma a uma (é `anim`, não `look`, mas também é conteúdo).
 */
const TextoComAparencia: React.FC<{
	conteudo: string;
	look?: TextLook;
	lookColor?: string;
	anim?: Layer["anim"];
	brand: BrandKit;
	ms: number;
	durationMs: number;
}> = ({ conteudo, look, lookColor, anim, brand, ms, durationMs }) => {
	// Máquina de escrever: revela em 60% da cena, para a frase ficar lida antes de sair.
	let texto = conteudo;
	if (anim === "typewriter") {
		const p = Math.min(1, ms / Math.max(1, durationMs * 0.6));
		texto = conteudo.slice(0, Math.ceil(conteudo.length * p));
	}

	if (look !== "red_word") return <>{texto}</>;

	// *palavra* vira palavra colorida. O asterisco some.
	const partes = texto.split(/(\*[^*]+\*)/g);
	return (
		<>
			{partes.map((parte, i) =>
				parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
					<span key={`r-${String(i)}`} style={{ color: lookColor ?? "#FF3B30" }}>
						{parte.slice(1, -1)}
					</span>
				) : (
					parte
				),
			)}
		</>
	);
};

/** Caixa de painel: o mesmo vidro dos cartões, para os painéis novos não parecerem de outro kit. */
const vidro = (raio = 28): React.CSSProperties => ({
	// 0,88 e não 0,72: a 72% o cartão sumia por cima de conteúdo claro — no criativo do panda o
	// mapa do corpo ficou lavado sobre a barriga branca dele (19/10/2026).
	background: "rgba(18,9,31,0.88)",
	backdropFilter: "blur(14px)",
	WebkitBackdropFilter: "blur(14px)",
	border: "1px solid rgba(255,255,255,0.14)",
	borderRadius: raio,
	boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
});

/** Corpo de frente com os pontos de aplicação. O ponto escolhido acende e pulsa de leve. */
const BodyMap: React.FC<{
	layer: Extract<Layer, { type: "body_map" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const cor = layer.color ?? brand.accent;
	// Coordenadas no viewBox 0 0 100 190 — a mesma figura do seletor do app.
	const pontos: Record<string, [number, number]> = {
		// Conferido no still (19/10/2026): o tronco vai de y34 a y96, então o abdômen fica entre
		// 72 e 88 — fora disso o ponto cai na perna, que foi o erro da primeira versão.
		abdomen_ul: [43, 73],
		abdomen_ur: [57, 73],
		abdomen_ll: [43, 87],
		abdomen_lr: [57, 87],
		thigh_l: [41, 122],
		thigh_r: [59, 122],
		arm_l: [21, 68],
		arm_r: [79, 68],
	};

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					...vidro(),
					padding: "22px 18px",
					textAlign: "center",
				}}
			>
				<svg viewBox="0 0 100 190" style={{ width: "100%", height: "auto" }}>
					<g fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.4}>
						<circle cx="50" cy="18" r="13" />
						<rect x="33" y="34" width="34" height="62" rx="14" />
						<rect x="14" y="38" width="15" height="52" rx="7.5" />
						<rect x="71" y="38" width="15" height="52" rx="7.5" />
						<rect x="35" y="98" width="13" height="74" rx="6.5" />
						<rect x="52" y="98" width="13" height="74" rx="6.5" />
					</g>
					{layer.spots.map((s) => {
						const ponto = pontos[s];
						const pulso = 1 + Math.sin(ms / 220) * 0.08;

						return (
							<g key={s}>
								<circle cx={ponto[0]} cy={ponto[1]} r={7 * p * pulso} fill={cor} opacity={0.35} />
								<circle cx={ponto[0]} cy={ponto[1]} r={4 * p} fill={cor} />
							</g>
						);
					})}
				</svg>
				{layer.label ? (
					<div
						style={{
							marginTop: 10,
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							fontWeight: 700,
							fontSize: 30,
							color: brand.fg,
							opacity: p,
						}}
					>
						{layer.label}
					</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};

/** Prato dividido: as fatias crescem em sequência e cada uma leva seu nome. */
const Plate: React.FC<{
	layer: Extract<Layer, { type: "plate" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const total = layer.slices.reduce((a, s) => a + s.percent, 0);
	const cores = ["#5CC98C", "#8630E4", "#F2B13C", "#59A7F0", "#E86A6A"];
	let acumulado = 0;
	const paradas = layer.slices.map((s, i) => {
		const ini = (acumulado / total) * 360;
		acumulado += s.percent;
		const fim = (acumulado / total) * 360;

		return `${s.color ?? cores[i % cores.length]} ${ini}deg ${fim * p + ini * (1 - p)}deg`;
	});

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					...vidro(),
					padding: 24,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 16,
				}}
			>
				<div
					style={{
						width: "70%",
						aspectRatio: "1 / 1",
						borderRadius: "50%",
						background: `conic-gradient(${paradas.join(",")}, rgba(255,255,255,0.08) 0deg)`,
						border: "8px solid rgba(255,255,255,0.9)",
						boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
					}}
				/>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
					{layer.slices.map((s, i) => (
						<div
							key={s.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								fontFamily: `Montserrat, ${brand.fontFamily}`,
								fontWeight: 700,
								fontSize: 26,
								color: brand.fg,
								opacity: Math.max(0, Math.min(1, p * layer.slices.length - i)),
							}}
						>
							<span style={{ width: 18, height: 18, borderRadius: 5, background: s.color ?? cores[i % cores.length] }} />
							{s.label} · {s.percent}%
						</div>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};

/** Troca: o cartão da esquerda sai riscado, a seta corre, o da direita entra. */
const Swap: React.FC<{
	layer: Extract<Layer, { type: "swap" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const entra = suave(Math.max(0, Math.min(1, (ms - layer.drawMs * 0.5) / (layer.drawMs * 0.5))));

	const cartao = (titulo: string, icone: string | undefined, ok: boolean, aparecer: number): React.ReactNode => (
		<div
			style={{
				...vidro(22),
				flex: 1,
				padding: "20px 16px",
				textAlign: "center",
				opacity: aparecer,
				transform: `scale(${0.92 + aparecer * 0.08})`,
				borderColor: ok ? "rgba(92,201,140,0.6)" : "rgba(232,106,106,0.6)",
			}}
		>
			{icone ? <div style={{ fontSize: 56, lineHeight: 1.1 }}>{icone}</div> : null}
			<div
				style={{
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					fontWeight: 800,
					fontSize: 30,
					color: brand.fg,
					textDecoration: ok ? "none" : "line-through",
					opacity: ok ? 1 : 0.75,
				}}
			>
				{titulo}
			</div>
		</div>
	);

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					display: "flex",
					alignItems: "center",
					gap: 14,
				}}
			>
				{cartao(layer.fromLabel, layer.fromIcon, false, p)}
				<div style={{ textAlign: "center", minWidth: 70 }}>
					<div style={{ fontSize: 46, color: brand.accent, opacity: p }}>→</div>
					{layer.note ? (
						<div
							style={{
								fontFamily: `Montserrat, ${brand.fontFamily}`,
								fontWeight: 700,
								fontSize: 22,
								color: "#5CC98C",
								opacity: entra,
							}}
						>
							{layer.note}
						</div>
					) : null}
				</div>
				{cartao(layer.toLabel, layer.toIcon, true, entra)}
			</div>
		</AbsoluteFill>
	);
};

/** Unidades que aparecem uma a uma — o "quanto é" virando imagem. */
const Units: React.FC<{
	layer: Extract<Layer, { type: "units" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const cor = layer.color ?? brand.accent;
	const passo = layer.drawMs / layer.count;
	const colunas = Math.min(10, Math.ceil(Math.sqrt(layer.count * 1.6)));
	const raio =
		layer.shape === "circle" ? "50%" : layer.shape === "pill" ? "999px" : layer.shape === "drop" ? "50% 50% 50% 0" : "8px";

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					...vidro(),
					padding: 22,
					textAlign: "center",
				}}
			>
				<div style={{ display: "grid", gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: 10, justifyItems: "center" }}>
					{Array.from({ length: layer.count }, (_, i) => {
						const a = suave(Math.max(0, Math.min(1, (ms - i * passo) / 260)));

						return (
							<div
								key={`u-${String(i)}`}
								style={{
									width: "100%",
									aspectRatio: "1 / 1",
									background: cor,
									borderRadius: raio,
									transform: `scale(${a}) rotate(${layer.shape === "drop" ? -45 : 0}deg)`,
									boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
								}}
							/>
						);
					})}
				</div>
				{layer.label ? (
					<div
						style={{
							marginTop: 14,
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							fontWeight: 800,
							fontSize: 32,
							color: brand.fg,
						}}
					>
						{layer.label}
					</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};

/** Medidor com limite: o arco enche e para; passou do limite, fica vermelho. */
const LimitGauge: React.FC<{
	layer: Extract<Layer, { type: "limit_gauge" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const v = layer.value * p;
	const passou = v > layer.limit;
	const cor = passou ? "#E86A6A" : v > layer.limit * 0.75 ? "#F2B13C" : "#5CC98C";
	// Semicírculo de raio 45: o arco mede π·45.
	const comprimento = Math.PI * 45;

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					...vidro(),
					padding: "24px 20px 18px",
					textAlign: "center",
				}}
			>
				<svg viewBox="0 0 100 58" style={{ width: "100%", height: "auto", overflow: "visible" }}>
					<path
						d="M5 52 A45 45 0 0 1 95 52"
						fill="none"
						stroke="rgba(255,255,255,0.16)"
						strokeWidth={10}
						strokeLinecap="round"
					/>
					<path
						d="M5 52 A45 45 0 0 1 95 52"
						fill="none"
						stroke={cor}
						strokeWidth={10}
						strokeLinecap="round"
						strokeDasharray={comprimento}
						strokeDashoffset={comprimento * (1 - v / 100)}
					/>
					<g transform={`rotate(${(layer.limit / 100) * 180 - 90}, 50, 52)`}>
						<line x1="50" y1="7" x2="50" y2="17" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
					</g>
				</svg>
				<div
					style={{
						marginTop: -6,
						fontFamily: `Montserrat, ${brand.fontFamily}`,
						fontWeight: 900,
						fontSize: 52,
						color: cor,
					}}
				>
					{layer.valueText ?? `${String(Math.round(v))}%`}
				</div>
				{layer.label ? (
					<div
						style={{
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							fontWeight: 600,
							fontSize: 26,
							color: "rgba(255,255,255,0.78)",
						}}
					>
						{layer.label}
					</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};

/** Sinais de alerta, um por linha, entrando em sequência. */
const WarningSigns: React.FC<{
	layer: Extract<Layer, { type: "warning_signs" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const cor = layer.color ?? "#F2B13C";

	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale})`,
					...vidro(),
					padding: "22px 24px",
					borderLeft: `8px solid ${cor}`,
				}}
			>
				{layer.title ? (
					<div
						style={{
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							fontWeight: 900,
							fontSize: 32,
							color: cor,
							textTransform: "uppercase",
							marginBottom: 12,
						}}
					>
						{layer.title}
					</div>
				) : null}
				{layer.items.map((item, i) => {
					const a = suave(Math.max(0, Math.min(1, (ms - i * layer.staggerMs) / 300)));

					return (
						<div
							key={item.text}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 14,
								padding: "8px 0",
								opacity: a,
								transform: `translateX(${(1 - a) * 24}px)`,
							}}
						>
							<span style={{ fontSize: 34 }}>{item.icon ?? "•"}</span>
							<span
								style={{
									fontFamily: `Montserrat, ${brand.fontFamily}`,
									fontWeight: 700,
									fontSize: 30,
									color: brand.fg,
								}}
							>
								{item.text}
							</span>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

/**
 * APONTADOR — o "olha aqui" do criativo. Dezesseis formas numa layer só.
 *
 * Todas se desenham no tempo de `drawMs`: as de traço com strokeDasharray, as cheias com escala
 * e opacidade. O desenho vive num viewBox 0 0 100 100 e é escalado por `size`, então a mesma
 * forma serve de apontador pequeno encostado num chip ou de marca grande no meio do quadro.
 */
const Pointer: React.FC<{
	layer: Extract<Layer, { type: "pointer" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const cor = layer.color ?? brand.accent;
	const forma = layer.shape;
	// Traço proporcional ao tamanho: apontador pequeno não pode ter traço de apontador grande.
	const traco = forma === "underline" || forma === "highlighter" ? 10 : 8;

	/** Caminhos desenhados em sequência — a ponta da seta vem depois do corpo. */
	const caminhos: Record<string, string[]> = {
		curved_arrow: ["M8 86 C30 86 70 70 88 30", "M88 30 L66 36", "M88 30 L84 54"],
		side_arrow: ["M6 50 L86 50", "M86 50 L62 32", "M86 50 L62 68"],
		down_arrow: ["M50 6 L50 80", "M50 80 L30 58", "M50 80 L70 58"],
		underline: ["M4 58 L96 58"],
		box: ["M8 18 L92 18", "M92 18 L92 82", "M92 82 L8 82", "M8 82 L8 18"],
		check: ["M14 54 L40 80 L88 20"],
		cross: ["M20 20 L80 80", "M80 20 L20 80"],
		exclamation: ["M50 10 L50 62", "M50 84 L50 86"],
		question: ["M26 30 C26 10 74 10 74 32 C74 50 50 50 50 66", "M50 84 L50 86"],
		rays: ["M50 8 L50 26", "M79 21 L68 32", "M92 50 L74 50", "M79 79 L68 68", "M50 92 L50 74", "M21 79 L32 68", "M8 50 L26 50", "M21 21 L32 32"],
	};

	const estilo: React.CSSProperties = {
		position: "absolute",
		left: `${layer.x}%`,
		top: `${layer.y}%`,
		width: `${layer.size}%`,
		transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale})`,
		overflow: "visible",
	};

	// Formas de traço: desenham caminho por caminho, na ordem.
	if (caminhos[forma]) {
		const tracos = caminhos[forma];
		const fatia = 1 / tracos.length;
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<svg viewBox="0 0 100 100" style={{ ...estilo, aspectRatio: "1 / 1", filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))" }}>
					{tracos.map((d, i) => {
						const local = Math.max(0, Math.min(1, (p - i * fatia) / fatia));
						return (
							<path
								key={`p-${String(i)}`}
								d={d}
								pathLength={1}
								fill="none"
								stroke={forma === "check" ? "#2BBF6A" : forma === "cross" ? "#E53935" : cor}
								strokeWidth={traco}
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeDasharray={1}
								strokeDashoffset={1 - local}
							/>
						);
					})}
				</svg>
			</AbsoluteFill>
		);
	}

	// Marca-texto: a faixa varre da esquerda, atrás do que estiver ali.
	if (forma === "highlighter") {
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<div
					style={{
						...estilo,
						height: `${layer.size * 0.32}%`,
						background: cor,
						opacity: 0.5,
						borderRadius: 4,
						transformOrigin: "left center",
						transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scaleX(${p})`,
						// Sem mix-blend-mode: `multiply` só aparece sobre fundo claro, e o marca-texto
						// tem de funcionar também sobre filmagem escura (testado em 19/10/2026).
					}}
				/>
			</AbsoluteFill>
		);
	}

	// Toque: o círculo pressiona e uma onda sai dele.
	if (forma === "tap") {
		const onda = (ms % 1200) / 1200;
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<svg viewBox="0 0 100 100" style={{ ...estilo, aspectRatio: "1 / 1" }}>
					<circle cx="50" cy="50" r={30 + onda * 20} fill="none" stroke={cor} strokeWidth={6} opacity={(1 - onda) * 0.8} />
					<circle cx="50" cy="50" r={26 * (1 - 0.12 * Math.sin(p * Math.PI))} fill={cor} opacity={0.9} />
				</svg>
			</AbsoluteFill>
		);
	}

	// Holofote: escurece o quadro todo e abre um buraco de luz no ponto.
	if (forma === "spotlight") {
		const r = layer.size * p;
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: `radial-gradient(circle at ${layer.x}% ${layer.y}%, rgba(0,0,0,0) ${r}%, rgba(0,0,0,0.72) ${r * 1.6}%)`,
					}}
				/>
			</AbsoluteFill>
		);
	}

	// Alternador ligando.
	if (forma === "toggle") {
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<svg viewBox="0 0 100 56" style={{ ...estilo, aspectRatio: "100 / 56" }}>
					<rect x="2" y="2" width="96" height="52" rx="26" fill={p > 0.5 ? cor : "#8A8A93"} />
					<circle cx={16 + 68 * suave(Math.max(0, (p - 0.25) / 0.75))} cy="28" r="20" fill="#FFFFFF" />
				</svg>
			</AbsoluteFill>
		);
	}

	// Bolha numerada: entra com mola.
	if (forma === "number") {
		return (
			<AbsoluteFill style={{ opacity: anim.opacity }}>
				<div
					style={{
						...estilo,
						aspectRatio: "1 / 1",
						borderRadius: "50%",
						background: cor,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#FFFFFF",
						fontFamily: `Montserrat, ${brand.fontFamily}`,
						fontWeight: 800,
						fontSize: `${layer.size * 0.42}vw`,
						boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
						transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale * (0.6 + 0.4 * p)})`,
					}}
				>
					{layer.text ?? "1"}
				</div>
			</AbsoluteFill>
		);
	}

	// Faixa com bico: o texto curto que nomeia o que está sendo apontado.
	return (
		<AbsoluteFill style={{ opacity: anim.opacity }}>
			<div
				style={{
					...estilo,
					width: "auto",
					maxWidth: `${Math.max(30, layer.size * 3)}%`,
					background: cor,
					color: "#FFFFFF",
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					fontWeight: 800,
					fontSize: `${Math.max(2, layer.size * 0.2)}vw`,
					padding: "0.5em 0.8em",
					borderRadius: 14,
					whiteSpace: "nowrap",
					boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
					transformOrigin: "center",
					transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale * (0.7 + 0.3 * p)})`,
				}}
			>
				{layer.text ?? ""}
			</div>
		</AbsoluteFill>
	);
};

/** Número que corre de `from` a `to`. */
const Counter: React.FC<{
	layer: Extract<Layer, { type: "counter" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.countMs));
	const valor = layer.from + (layer.to - layer.from) * p;
	const cor = layer.color ?? brand.accent;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
					opacity: anim.opacity,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 6,
					padding: layer.chip ? "18px 34px 24px" : 0,
					background: layer.chip ? cor : "transparent",
					borderRadius: 30,
					boxShadow: layer.chip ? "0 18px 46px rgba(0,0,0,0.42)" : "none",
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					color: layer.chip ? "#FFFFFF" : cor,
					textShadow: layer.chip ? "none" : "0 6px 22px rgba(0,0,0,0.6)",
					whiteSpace: "nowrap",
				}}
			>
				{layer.label ? (
					<div
						style={{
							fontSize: 28,
							fontWeight: 700,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							opacity: 0.85,
						}}
					>
						{layer.label}
					</div>
				) : null}
				<div style={{ fontSize: layer.size, fontWeight: 800, lineHeight: 1 }}>
					{layer.prefix ?? ""}
					{valor.toFixed(layer.decimals)}
					{layer.suffix ?? ""}
				</div>
			</div>
		</AbsoluteFill>
	);
};

/** Barra que cresce até `value`%. */
const Bar: React.FC<{
	layer: Extract<Layer, { type: "bar" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.growMs));
	const cor = layer.color ?? brand.accent;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
					opacity: anim.opacity,
					background: "rgba(10,6,18,0.86)",
					borderRadius: 26,
					padding: "20px 24px 24px",
					boxShadow: "0 18px 46px rgba(0,0,0,0.42)",
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					color: "#FFFFFF",
				}}
			>
				{layer.label || layer.valueText ? (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "baseline",
							marginBottom: 14,
						}}
					>
						<span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.04em" }}>{layer.label}</span>
						{layer.valueText ? (
							<span style={{ fontSize: 38, fontWeight: 800, color: cor }}>{layer.valueText}</span>
						) : null}
					</div>
				) : null}
				<div
					style={{
						height: 26,
						borderRadius: 999,
						background: "rgba(255,255,255,0.16)",
						overflow: "hidden",
					}}
				>
					<div style={{ width: `${layer.value * p}%`, height: "100%", borderRadius: 999, background: cor }} />
				</div>
			</div>
		</AbsoluteFill>
	);
};

/** Gráfico de linha que se desenha. Pontos 0..100, onde 0 é a base. */
const LineChart: React.FC<{
	layer: Extract<Layer, { type: "line_chart" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const p = suave(Math.min(1, ms / layer.drawMs));
	const cor = layer.color ?? brand.accent;
	const n = layer.points.length;
	const d = layer.points.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (n - 1)) * 100} ${100 - v}`).join(" ");
	const ultimo = layer.points[n - 1];

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
					opacity: anim.opacity,
					background: "rgba(10,6,18,0.86)",
					borderRadius: 28,
					padding: "20px 24px 18px",
					boxShadow: "0 18px 46px rgba(0,0,0,0.42)",
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					color: "#FFFFFF",
				}}
			>
				{layer.label ? (
					<div
						style={{
							fontSize: 30,
							fontWeight: 800,
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							opacity: 0.8,
							marginBottom: 10,
						}}
					>
						{layer.label}
					</div>
				) : null}
				<div style={{ position: "relative", height: `${layer.height * 12}px` }}>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						style={{ width: "100%", height: "100%", overflow: "visible" }}
					>
						<path
							d="M0 100 L100 100"
							stroke="rgba(255,255,255,0.18)"
							strokeWidth={3}
							vectorEffect="non-scaling-stroke"
							fill="none"
						/>
						<path
							d={d}
							pathLength={1}
							fill="none"
							stroke={cor}
							strokeWidth={10}
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
							strokeDasharray={1}
							strokeDashoffset={1 - p}
						/>
						{p > 0.98 ? <circle cx={100} cy={100 - ultimo} r={9} fill={cor} vectorEffect="non-scaling-stroke" /> : null}
					</svg>
					{layer.endLabel && p > 0.98 ? (
						<div
							style={{
								position: "absolute",
								right: 0,
								top: `${100 - ultimo}%`,
								transform: "translate(18%, -130%)",
								fontSize: 40,
								fontWeight: 800,
								color: cor,
								whiteSpace: "nowrap",
							}}
						>
							{layer.endLabel}
						</div>
					) : null}
				</div>
			</div>
		</AbsoluteFill>
	);
};

/**
 * Régua de seringa: traços numerados com uma faixa acesa no intervalo da dose.
 *
 * Os traços e os números são desenhados aqui, então nunca saem tortos. A faixa cresce de uma
 * ponta à outra em `drawMs` — é o movimento que leva o olho até o número certo.
 */
const SyringeRuler: React.FC<{
	layer: Extract<Layer, { type: "syringe_ruler" }>;
	brand: BrandKit;
	ms: number;
	anim: { opacity: number; scale: number; translateY: number };
}> = ({ layer, brand, ms, anim }) => {
	const cor = layer.color ?? brand.accent;
	const total = layer.to - layer.from;
	const pct = (v: number) => ((v - layer.from) / total) * 100;

	const tracos: number[] = [];
	for (let v = layer.from; v <= layer.to + 1e-9; v += layer.step) tracos.push(Number(v.toFixed(4)));

	const temFaixa = layer.highlightFrom !== undefined && layer.highlightTo !== undefined;
	const p = suave(Math.min(1, ms / layer.drawMs));
	const faixaIni = temFaixa ? pct(layer.highlightFrom as number) : 0;
	const faixaFim = temFaixa ? pct(layer.highlightTo as number) : 0;
	const faixaLarg = (faixaFim - faixaIni) * p;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: `${layer.x}%`,
					top: `${layer.y}%`,
					width: `${layer.width}%`,
					transform: `translate(-50%, -50%) scale(${anim.scale}) translateY(${anim.translateY}px)`,
					opacity: anim.opacity,
					background: "rgba(10,6,18,0.9)",
					borderRadius: 26,
					padding: "22px 26px 18px",
					boxShadow: "0 18px 46px rgba(0,0,0,0.5)",
					fontFamily: `Montserrat, ${brand.fontFamily}`,
					color: "#FFFFFF",
				}}
			>
				{layer.label ? (
					<div
						style={{
							position: "relative",
							height: 46,
							marginBottom: 4,
						}}
					>
						<div
							style={{
								position: "absolute",
								left: `${faixaIni + (faixaFim - faixaIni) / 2}%`,
								transform: "translateX(-50%)",
								background: cor,
								borderRadius: 14,
								padding: "6px 18px 10px",
								fontSize: 32,
								fontWeight: 800,
								textTransform: "uppercase",
								whiteSpace: "nowrap",
								opacity: p > 0.75 ? 1 : 0,
							}}
						>
							{layer.label}
						</div>
					</div>
				) : null}

				<div style={{ position: "relative", height: 74 }}>
					{/* faixa acesa, cresce da esquerda para a direita */}
					{temFaixa ? (
						<div
							style={{
								position: "absolute",
								left: `${faixaIni}%`,
								width: `${faixaLarg}%`,
								top: 0,
								bottom: 26,
								background: cor,
								borderRadius: 8,
								opacity: 0.9,
							}}
						/>
					) : null}

					{/* linha de base */}
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: 26,
							height: 4,
							background: "rgba(255,255,255,0.35)",
						}}
					/>

					{/* traços */}
					{tracos.map((v) => {
						const grande = Math.abs(v % layer.labelEvery) < 1e-6;
						const dentro = temFaixa && v >= (layer.highlightFrom as number) && v <= (layer.highlightTo as number);
						return (
							<div
								key={`t-${String(v)}`}
								style={{
									position: "absolute",
									left: `${pct(v)}%`,
									bottom: 26,
									width: grande ? 5 : 3,
									height: grande ? 34 : 20,
									marginLeft: grande ? -2.5 : -1.5,
									background: dentro && faixaLarg > 0 ? "#FFFFFF" : "rgba(255,255,255,0.75)",
									borderRadius: 2,
								}}
							/>
						);
					})}

					{/* números */}
					{tracos
						.filter((v) => Math.abs(v % layer.labelEvery) < 1e-6)
						.map((v) => (
							<div
								key={`n-${String(v)}`}
								style={{
									position: "absolute",
									left: `${pct(v)}%`,
									bottom: 0,
									transform: "translateX(-50%)",
									fontSize: 26,
									fontWeight: 700,
									color: "rgba(255,255,255,0.8)",
								}}
							>
								{v}
							</div>
						))}
				</div>
			</div>
		</AbsoluteFill>
	);
};

const Karaoke: React.FC<{
	layer: Extract<Layer, { type: "karaoke" }>;
	brand: BrandKit;
	durationInFrames: number;
	layout: Layout;
}> = ({ layer, brand, durationInFrames, layout }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const words = layer.text.split(/\s+/).filter(Boolean);
	// Palavras-chave que ficam maiores e coloridas mesmo quando não são a palavra ativa.
	const limpa = (w: string) => w.toLowerCase().replace(/[.,!?;:]/g, "");
	const marcadas = new Set((layer.emphasis ?? []).map(limpa));

	const nowMs = (frame / fps) * 1000;
	const totalMs = (durationInFrames / fps) * 1000;
	// Even split when there is no voiceover alignment to read timings from.
	const ends = layer.wordEndsMs ?? words.map((_, i) => ((i + 1) * totalMs) / words.length);
	const found = ends.findIndex((end) => nowMs < end);
	const activeIndex = found === -1 ? words.length - 1 : found;

	// No máximo 4 palavras na tela: bloco inteiro de frase cansa e tira o ritmo. O grupo
	// avança junto com a fala, então o olho lê o que está sendo dito e nada mais.
	const POR_TELA = layer.maxWords ?? 3;
	const grupo = Math.floor(activeIndex / POR_TELA);
	const inicio = grupo * POR_TELA;
	const visiveis = words.slice(inicio, inicio + POR_TELA);

	return (
		<AbsoluteFill
			style={{
				justifyContent: "flex-end",
				alignItems: "center",
				// Mais alta que o rodapé clássico: perto do centro, que é onde o olho já está.
				// `layout.bottom` mantém a mesma proporção nos 3 formatos; `bottomPct` desce a
				// legenda quando a cena tem elemento embaixo.
				paddingBottom: layout.bottom(layer.bottomPct ? (layer.bottomPct / 100) * 1920 : 700),
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					alignItems: "center",
					gap: "10px 14px",
					maxWidth: "86%",
					fontFamily: "Montserrat, " + brand.fontFamily,
					fontSize: layer.size ?? 62,
					fontWeight: 800,
					lineHeight: 1.1,
					textAlign: "center",
					letterSpacing: "0.005em",
				}}
			>
				{visiveis.map((w, i) => {
					const ativa = inicio + i === activeIndex;
					const destaque = marcadas.has(limpa(w));
					const cor = layer.activeColor ?? brand.accent;
					const caixa = layer.style === "box" && ativa;
					// `pop`: a palavra cresce no instante exato em que é dita.
					const pulo = layer.style === "pop" && ativa;
					const escala = pulo ? 1.14 : 1;

					return (
						<span
							key={`${w}-${String(inicio + i)}`}
							style={{
								// A palavra falada ganha cor (ou caixa); as outras ficam brancas.
								color: caixa ? "#FFFFFF" : ativa || destaque ? cor : brand.fg,
								background: caixa ? cor : "transparent",
								borderRadius: caixa ? 16 : 0,
								padding: caixa ? "6px 16px 12px" : "4px 2px 8px",
								// Palavra marcada em `emphasis` fica maior o tempo todo.
								fontSize: destaque ? "1.18em" : undefined,
								display: "inline-block",
								// a palavra cresce a partir do centro, então precisa de margem
								// lateral própria — sem isto ela encosta na palavra vizinha.
								margin: pulo ? "0 10px" : undefined,
								transform: `scale(${escala})`,
								transformOrigin: "center bottom",
								// Sombra preta difusa em volta, em camadas — dá o contorno sem o
								// traço duro do stroke, que deixa a legenda com cara de adesivo.
								textShadow: caixa
									? "none"
									: "0 0 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.85), 0 4px 14px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
							}}
						>
							{w}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

const PlaceholderLayer: React.FC<{
	brand: BrandKit;
	label: string;
	detail: string;
	opacity: number;
	layout: Layout;
}> = ({ brand, label, detail, opacity, layout }) => (
	<AbsoluteFill
		style={{
			opacity,
			background: `linear-gradient(160deg, ${brand.accent}33, ${brand.bg})`,
			// Pinned to the top: the middle and lower thirds belong to the copy, and a
			// placeholder that collides with the hook makes a preview useless for judging it.
			justifyContent: "flex-start",
			alignItems: "center",
			// Below the badge zone (which now owns the top ~400px) and above the caption band.
			paddingTop: layout.top(420),
			paddingLeft: layout.x(60),
			paddingRight: layout.x(60),
			border: `2px dashed ${brand.accent}`,
		}}
	>
		<div
			style={{
				fontFamily: brand.fontFamily,
				color: brand.fg,
				opacity: 0.5,
				textAlign: "center",
				maxWidth: "80%",
			}}
		>
			<div style={{ fontSize: layout.size(28), letterSpacing: layout.size(4), textTransform: "uppercase" }}>{label}</div>
			<div style={{ fontSize: layout.size(24), marginTop: layout.size(12), lineHeight: 1.3 }}>{detail}</div>
		</div>
	</AbsoluteFill>
);

const isVideoSrc = (src: string): boolean => /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(src);

/**
 * Screen shapes a phone can plausibly have (w/h). Media in this range gets a screen of exactly its
 * shape (nothing cropped, no bars); outside it (a landscape clip, a banner) the screen is clamped and
 * the media is shown whole over a blurred copy of itself.
 */
const SCREEN_ASPECT_MIN = 9 / 21;
const SCREEN_ASPECT_MAX = 9 / 15;

const AppScreen: React.FC<{
	layer: Extract<Layer, { type: "app_screen_recording" }>;
	brand: BrandKit;
	layout: Layout;
	durationInFrames: number;
	opacity: number;
	transform: string;
}> = ({ layer, brand, layout, durationInFrames, opacity, transform }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const src = layer.src ? resolveSrc(layer.src) : null;
	const isVideo = !!layer.src && isVideoSrc(layer.src);
	const inDevice = layer.device !== "none";
	// Only a phone needs the media's shape; full-screen (device "none") stays a cover crop.
	const mediaAspect = useMediaAspect(inDevice ? src : null, isVideo ? "video" : "image");
	const screenAspect = mediaAspect === null ? null : Math.min(SCREEN_ASPECT_MAX, Math.max(SCREEN_ASPECT_MIN, mediaAspect));
	const fitsExactly = screenAspect !== null && mediaAspect !== null && Math.abs(screenAspect - mediaAspect) < 0.005;
	const fit = !inDevice || screenAspect === null || fitsExactly ? "cover" : "contain";

	// A static screenshot with no explicit anim otherwise sits dead on screen — give it
	// an automatic, subtle Ken Burns push so it reads as "alive" without a spec change.
	const kenBurnsScale =
		src && !isVideo && layer.anim === "none"
			? interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: "clamp" })
			: 1;

	return (
		<AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform }}>
			<DeviceFrame enabled={inDevice} brand={brand} layout={layout} screenAspect={screenAspect}>
				{src && isVideo ? (
					// Screen recordings carry UI sounds and mic noise; the spec's audio track owns sound.
					<div style={{ width: "100%", height: "100%", background: fit === "contain" ? "#000" : undefined }}>
						<OffthreadVideo
							src={src}
							trimBefore={layer.startFromMs ? msToFrames(layer.startFromMs, fps) : undefined}
							muted
							style={{ width: "100%", height: "100%", objectFit: fit }}
						/>
					</div>
				) : src ? (
					// Clip the Ken Burns overscan so it never peeks outside the frame/device.
					<div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
						{fit === "contain" ? (
							<Img
								src={src}
								style={{
									position: "absolute",
									inset: 0,
									width: "100%",
									height: "100%",
									objectFit: "cover",
									filter: `blur(${layout.size(28)}px) brightness(0.7)`,
									transform: "scale(1.15)",
								}}
							/>
						) : null}
						<Img
							src={src}
							style={{
								position: "relative",
								width: "100%",
								height: "100%",
								objectFit: fit,
								transform: `scale(${kenBurnsScale})`,
							}}
						/>
					</div>
				) : (
					<PlaceholderLayer brand={brand} label="app screen" detail={layer.assetId ?? "sem asset"} opacity={opacity} layout={layout} />
				)}
			</DeviceFrame>
		</AbsoluteFill>
	);
};

const DeviceFrame: React.FC<{
	enabled: boolean;
	brand: BrandKit;
	layout: Layout;
	/** Shape (w/h) of the media's screen; null = the stock 9:19.5 phone (placeholder / unknown). */
	screenAspect: number | null;
	children: React.ReactNode;
}> = ({ enabled, brand, layout, screenAspect, children }) => {
	if (!enabled) return <>{children}</>;

	// Mockup real da marca (PNG 1080x1920 com a área da tela vazada). A gravação entra POR BAIXO,
	// exatamente no retângulo da tela; a moldura por cima faz o recorte dos cantos e mantém o
	// notch. Medidas tiradas do próprio arquivo: tela x 117..961, y 126..1870.
	const TELA = { left: "10.83%", top: "2.81%", width: "78.24%", height: "94.64%" };

	return (
		<div
			style={{
				position: "relative",
				height: "90%",
				aspectRatio: "1080 / 1920",
				filter: `drop-shadow(0 40px 90px ${brand.accent}66)`,
			}}
		>
			<div style={{ position: "absolute", ...TELA, overflow: "hidden", background: "#000" }}>
				{children}
			</div>
			<Img
				src={resolveSrc("mockups/iphone-roxo-vazado.png")}
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
			/>
		</div>
	);
};
