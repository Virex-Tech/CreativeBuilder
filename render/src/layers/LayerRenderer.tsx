import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";

import { layoutFor, type Layout } from "../formats";
import { useMediaAspect } from "./mediaAspect";
import { BADGE_TOP, badgeHeight, resolveAnim, resolveTextPreset, TOP_STACK_GAP } from "../presets/anims";
import { resolveSrc } from "../resolveSrc";
import { msToFrames, type BrandKit, type Layer } from "../spec";

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
	const anim = resolveAnim(layer.anim, frame, fps, durationInFrames);
	// Every px below is in base 1080×1920 px, scaled to the composition (identity at 9:16).
	const L = layoutFor(width, height);
	const z = L.size;

	const transform = `scale(${anim.scale}) translateY(${anim.translateY}px)`;

	switch (layer.type) {
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
						}}
					>
						{layer.content}
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
							background: "rgba(10,10,12,0.88)",
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
								color: brand.accent,
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

		case "image":
			return (
				<AbsoluteFill>
					<Img
						src={resolveSrc(layer.src)}
						style={{
							position: "absolute",
							left: `${layer.x}%`,
							top: `${layer.y}%`,
							width: `${layer.width}%`,
							transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${anim.scale}) translateY(${anim.translateY}px)`,
							opacity: anim.opacity,
							filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.45))",
						}}
					/>
				</AbsoluteFill>
			);

		case "hud": {
			// Barra fixa no topo com slots que enchem — o "0/6" das referências. Dá sensação de
			// progresso sem precisar narrar o progresso.
			return (
				<AbsoluteFill style={{ opacity: anim.opacity }}>
					<div
						style={{
							position: "absolute",
							top: `${layer.y}%`,
							left: "50%",
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
							<span style={{ color: brand.accent }}>{`${layer.filled}/${layer.slots}`}</span>
						</div>
						<div style={{ display: "flex", gap: 10 }}>
							{Array.from({ length: layer.slots }).map((_, i) => (
								<div
									key={`slot-${String(i)}`}
									style={{
										width: 72,
										height: 72,
										borderRadius: 20,
										background: i < layer.filled ? brand.accent : "rgba(255,255,255,0.22)",
										border: `3px solid ${i < layer.filled ? brand.accent : "rgba(255,255,255,0.45)"}`,
										boxShadow: i < layer.filled ? `0 8px 20px ${brand.accent}66` : "none",
									}}
								/>
							))}
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
							borderRadius: 30,
							padding: "26px 30px 30px",
							boxShadow: "0 26px 60px rgba(0,0,0,0.45)",
							fontFamily: `Montserrat, ${brand.fontFamily}`,
							color: "#12091F",
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
									color: "#5B5668",
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
									borderBottom: i < layer.items.length - 1 ? "2px solid #EFE9F7" : "none",
									position: "relative",
								}}
							>
								<span style={{ fontSize: 50, fontWeight: 700 }}>
									{it.check ? "✓ " : ""}
									{it.label}
								</span>
								{it.value ? (
									<span style={{ fontSize: 50, fontWeight: 800, color: "#5B5668" }}>{it.value}</span>
								) : null}
								{it.struck ? (
									<div
										style={{
											position: "absolute",
											left: -6,
											right: -6,
											top: "52%",
											height: 6,
											borderRadius: 4,
											background: "#E53935",
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
			const paleta = {
				dark: { fundo: "rgba(18,9,31,0.92)", texto: "#FFFFFF", rotulo: brand.accent },
				light: { fundo: "rgba(255,255,255,0.96)", texto: "#12091F", rotulo: brand.accent },
				accent: { fundo: brand.accent, texto: "#FFFFFF", rotulo: "rgba(255,255,255,0.75)" },
				alert: { fundo: "#C62828", texto: "#FFFFFF", rotulo: "rgba(255,255,255,0.8)" },
			}[layer.variant];

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
				color: brand.fg,
				whiteSpace: layer.width ? "normal" : "nowrap",
				width: layer.width ? `${layer.width}%` : undefined,
				boxSizing: "border-box" as const,
				textAlign: "center",
				lineHeight: 1.12,
			};
			const comChip: React.CSSProperties = layer.chip
				? {
						background: brand.accent,
						borderRadius: 28,
						padding: "20px 34px 26px",
						boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
						textTransform: "uppercase",
					}
				: { textShadow: "0 6px 24px rgba(0,0,0,0.55)" };

			return (
				<AbsoluteFill>
					<div style={{ ...base, ...comChip }}>{layer.content}</div>
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
const Karaoke: React.FC<{
	layer: Extract<Layer, { type: "karaoke" }>;
	brand: BrandKit;
	durationInFrames: number;
	layout: Layout;
}> = ({ layer, brand, durationInFrames, layout }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const words = layer.text.split(/\s+/).filter(Boolean);

	const nowMs = (frame / fps) * 1000;
	const totalMs = (durationInFrames / fps) * 1000;
	// Even split when there is no voiceover alignment to read timings from.
	const ends = layer.wordEndsMs ?? words.map((_, i) => ((i + 1) * totalMs) / words.length);
	const found = ends.findIndex((end) => nowMs < end);
	const activeIndex = found === -1 ? words.length - 1 : found;

	// No máximo 4 palavras na tela: bloco inteiro de frase cansa e tira o ritmo. O grupo
	// avança junto com a fala, então o olho lê o que está sendo dito e nada mais.
	const POR_TELA = 3;
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
					fontSize: 62,
					fontWeight: 800,
					lineHeight: 1.1,
					textAlign: "center",
					letterSpacing: "0.005em",
				}}
			>
				{visiveis.map((w, i) => {
					const ativa = inicio + i === activeIndex;
					return (
						<span
							key={`${w}-${String(inicio + i)}`}
							style={{
								// A palavra falada fica roxa; as outras, brancas.
								color: ativa ? brand.accent : brand.fg,
								padding: "4px 2px 8px",
								// Sombra preta difusa em volta, em camadas — dá o contorno sem o
								// traço duro do stroke, que deixa a legenda com cara de adesivo.
								textShadow:
									"0 0 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.85), 0 4px 14px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
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
