import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";

import { resolveAnim, resolveTextPreset } from "../presets/anims";
import { resolveSrc } from "../resolveSrc";
import type { BrandKit, Layer } from "../spec";

interface Props {
	layer: Layer;
	brand: BrandKit;
	durationInFrames: number;
}

/**
 * Renders one layer of a scene.
 *
 * Everything textual and structural lives HERE, in the deterministic layer — never in a
 * generative model. Models misspell words and mangle UI, and a single wrong letter is what
 * makes an ad read as AI slop. The generative providers only supply moving imagery.
 */
export const LayerRenderer: React.FC<Props> = ({ layer, brand, durationInFrames }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const anim = resolveAnim(layer.anim, frame, fps, durationInFrames);

	const transform = `scale(${anim.scale}) translateY(${anim.translateY}px)`;

	switch (layer.type) {
		case "solid":
			return <AbsoluteFill style={{ backgroundColor: layer.color, opacity: anim.opacity }} />;

		case "text": {
			const style = resolveTextPreset(layer.preset, brand);

			return (
				<AbsoluteFill
					style={{
						justifyContent: style.bottom === undefined ? "center" : "flex-end",
						alignItems: "center",
						padding: "0 60px",
						paddingBottom: style.bottom,
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
						style={{ width: "100%", height: "100%", objectFit: layer.fit }}
					/>
				</AbsoluteFill>
			) : (
				<PlaceholderLayer
					brand={brand}
					label="b-roll"
					detail={layer.prompt}
					opacity={anim.opacity}
				/>
			);

		case "app_screen_recording":
			return (
				<AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform }}>
					<DeviceFrame enabled={layer.device !== "none"} brand={brand}>
						{layer.src && isVideoSrc(layer.src) ? (
							// Screen recordings carry UI sounds and mic noise; the spec's audio track owns sound.
							<OffthreadVideo
								src={resolveSrc(layer.src)}
								muted
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						) : layer.src ? (
							<Img
								src={resolveSrc(layer.src)}
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						) : (
							<PlaceholderLayer
								brand={brand}
								label="app screen"
								detail={layer.assetId ?? "sem asset"}
								opacity={anim.opacity}
							/>
						)}
					</DeviceFrame>
				</AbsoluteFill>
			);

		case "badge":
			return (
				<AbsoluteFill
					style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 150 }}
				>
					<div
						style={{
							background: "rgba(10,10,12,0.88)",
							borderRadius: 36,
							padding: "22px 54px",
							textAlign: "center",
							fontFamily: brand.fontFamily,
							transform: `scale(${anim.scale})`,
							opacity: anim.opacity,
						}}
					>
						{layer.label ? (
							<div
								style={{
									fontSize: 34,
									fontWeight: 700,
									letterSpacing: 6,
									color: brand.fg,
									opacity: 0.9,
								}}
							>
								{layer.label.toUpperCase()}
							</div>
						) : null}
						<div
							style={{
								fontSize: 84,
								fontWeight: 900,
								lineHeight: 1,
								color: brand.accent,
								marginTop: layer.label ? 6 : 0,
							}}
						>
							{layer.value}
						</div>
					</div>
				</AbsoluteFill>
			);

		case "karaoke":
			return <Karaoke layer={layer} brand={brand} durationInFrames={durationInFrames} />;

		case "disclaimer":
			return (
				<AbsoluteFill
					style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 48 }}
				>
					<div
						style={{
							fontFamily: brand.fontFamily,
							fontSize: 22,
							fontWeight: 600,
							color: brand.fg,
							opacity: 0.85,
							textShadow: "0 2px 8px rgba(0,0,0,0.9)",
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
}> = ({ layer, brand, durationInFrames }) => {
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
			style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 300 }}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "0 18px",
					maxWidth: "88%",
					fontFamily: brand.fontFamily,
					fontSize: 58,
					fontWeight: 800,
					lineHeight: 1.15,
					textAlign: "center",
					textShadow: "0 4px 16px rgba(0,0,0,0.85)",
				}}
			>
				{words.map((w, i) => (
					<span
						key={`${w}-${String(i)}`}
						style={{ color: i === activeIndex ? brand.accent : brand.fg }}
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
}> = ({ brand, label, detail, opacity }) => (
	<AbsoluteFill
		style={{
			opacity,
			background: `linear-gradient(160deg, ${brand.accent}33, ${brand.bg})`,
			// Pinned to the top: the middle and lower thirds belong to the copy, and a
			// placeholder that collides with the hook makes a preview useless for judging it.
			justifyContent: "flex-start",
			alignItems: "center",
			// Below the badge zone (which owns the top ~330px) and above the caption band.
			paddingTop: 380,
			paddingLeft: 60,
			paddingRight: 60,
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
			<div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase" }}>{label}</div>
			<div style={{ fontSize: 24, marginTop: 12, lineHeight: 1.3 }}>{detail}</div>
		</div>
	</AbsoluteFill>
);

const isVideoSrc = (src: string): boolean => /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(src);

const DeviceFrame: React.FC<{
	enabled: boolean;
	brand: BrandKit;
	children: React.ReactNode;
}> = ({ enabled, brand, children }) => {
	if (!enabled) return <>{children}</>;

	return (
		<div
			style={{
				width: "78%",
				aspectRatio: "9 / 19.5",
				borderRadius: 64,
				padding: 12,
				background: "#111",
				boxShadow: `0 40px 120px ${brand.accent}55, 0 0 0 2px #2a2a2a`,
				overflow: "hidden",
			}}
		>
			<div style={{ width: "100%", height: "100%", borderRadius: 52, overflow: "hidden" }}>
				{children}
			</div>
		</div>
	);
};
