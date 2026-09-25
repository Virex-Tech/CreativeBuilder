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
						style={{ width: "100%", height: "100%", objectFit: layer.fit }}
					/>
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
	const z = layout.size;
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const words = layer.text.split(/\s+/).filter(Boolean);

	const nowMs = (frame / fps) * 1000;
	const totalMs = (durationInFrames / fps) * 1000;
	// Even split when there is no voiceover alignment to read timings from.
	const ends = layer.wordEndsMs ?? words.map((_, i) => ((i + 1) * totalMs) / words.length);
	const activeIndex = ends.findIndex((end) => nowMs < end);

	return (
		<AbsoluteFill
			style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: layout.bottom(420) }}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: `0 ${z(18)}px`,
					maxWidth: "88%",
					fontFamily: brand.fontFamily,
					fontSize: z(66),
					fontWeight: 800,
					lineHeight: 1.25,
					textAlign: "center",
					textShadow: `0 ${z(4)}px ${z(16)}px rgba(0,0,0,0.85)`,
				}}
			>
				{words.map((w, i) => (
					<span
						key={`${w}-${String(i)}`}
						// The spoken word gets a brand-colour box: coloured text alone vanishes over bright footage.
						style={
							i === activeIndex
								? { color: brand.fg, background: brand.accent, borderRadius: z(14), padding: `0 ${z(14)}px`, textShadow: "none" }
								: { color: brand.fg, padding: `0 ${z(2)}px` }
						}
					>
						{w}
					</span>
				))}
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

/** Phone mock proportions and how much of the frame it may take (tuned on 1080×1920). */
const DEVICE_ASPECT = 9 / 19.5;
const DEVICE_MAX_W = 0.78;
/** 78% of 1080 at 9/19.5 is 1825.2px tall = 95.0625% of 1920 — the same cap for any height. */
const DEVICE_MAX_H = (DEVICE_MAX_W * 1080) / DEVICE_ASPECT / 1920;
const DEVICE_BASE_W = DEVICE_MAX_W * 1080;
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

	// Width-bound on 9:16 (78% of the width, as always); height-bound on shorter frames, where
	// 78% of the width would push the phone off the top and bottom of a 4:5 or 1:1 canvas.
	const aspect = screenAspect ?? DEVICE_ASPECT;
	const byWidth = DEVICE_MAX_W * layout.w;
	const byHeight = DEVICE_MAX_H * layout.h * aspect;
	const width = byWidth <= byHeight + 0.01 ? byWidth : byHeight;
	const k = width / DEVICE_BASE_W;
	const pad = 12 * k;

	return (
		<div
			style={{
				width,
				// Content-box: width/height are the SCREEN inside the bezel padding. The stock phone keeps
				// its exact old geometry; a media-shaped one gets the media's shape, so cover crops nothing.
				...(screenAspect === null ? { aspectRatio: "9 / 19.5" } : { height: width / screenAspect }),
				borderRadius: 64 * k,
				padding: pad,
				background: "#111",
				boxShadow: `0 ${40 * k}px ${120 * k}px ${brand.accent}55, 0 0 0 2px #2a2a2a`,
				overflow: "hidden",
			}}
		>
			<div style={{ width: "100%", height: "100%", borderRadius: 52 * k, overflow: "hidden" }}>
				{children}
			</div>
		</div>
	);
};
