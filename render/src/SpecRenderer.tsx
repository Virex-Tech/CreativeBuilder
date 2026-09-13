import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { AudioTracks } from "./layers/AudioTracks";
import { LayerRenderer } from "./layers/LayerRenderer";
import { resolveTransition } from "./presets/anims";
import { msToFrames, type CreativeSpec, type Scene } from "./spec";

/**
 * The ONE composition.
 *
 * Every creative — every app, every locale, every variation — renders through here. There
 * is deliberately no "one composition per video": that is the pattern that makes Remotion
 * projects collapse once you have hundreds of creatives, because each new video becomes a
 * code change instead of data.
 */
export const SpecRenderer: React.FC<{ spec: CreativeSpec }> = ({ spec }) => {
	const { fps } = useVideoConfig();
	const brand = spec.brandKit;

	return (
		<AbsoluteFill style={{ backgroundColor: brand.bg }}>
			<AudioTracks audio={spec.audio} />
			{spec.scenes.map((scene, sceneIndex) => {
				const from = msToFrames(scene.startMs, fps);
				const durationInFrames = msToFrames(scene.durationMs, fps);
				// The opening scene has nothing to transition from, so it always cuts in.
				const transitionIn = sceneIndex === 0 ? "cut" : scene.transitionIn;

				return (
					<Sequence
						key={scene.id}
						from={from}
						durationInFrames={durationInFrames}
						name={`${scene.role}:${scene.id}`}
					>
						<SceneEnter transitionIn={transitionIn} transitionMs={scene.transitionMs}>
							{scene.layers.map((layer, i) => {
								// A layer may start later than its scene and end earlier — that is how a
								// caption appears after the cut without needing a scene of its own.
								const layerFrom = msToFrames(layer.startMs ?? 0, fps) - (layer.startMs ? 0 : 1);
								const layerDuration = layer.durationMs
									? msToFrames(layer.durationMs, fps)
									: durationInFrames - Math.max(0, layerFrom);

								return (
									<Sequence
										key={`${scene.id}-${String(i)}`}
										from={Math.max(0, layerFrom)}
										durationInFrames={Math.max(1, layerDuration)}
										name={layer.type}
									>
										<LayerRenderer
											layer={layer}
											brand={brand}
											durationInFrames={Math.max(1, layerDuration)}
										/>
									</Sequence>
								);
							})}
						</SceneEnter>
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

/**
 * Applies a scene's entrance effect to its own layers, for the first `transitionMs` of the
 * scene's own `Sequence`. `useCurrentFrame` here is already relative to that Sequence, so
 * this never touches `startMs`/duration — it only changes how the opening frames look.
 */
const SceneEnter: React.FC<{
	transitionIn: Scene["transitionIn"];
	transitionMs: number;
	children: React.ReactNode;
}> = ({ transitionIn, transitionMs, children }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	if (transitionIn === "cut") return <>{children}</>;

	const t = resolveTransition(transitionIn, frame, fps, transitionMs);

	return (
		<>
			<AbsoluteFill style={{ opacity: t.opacity, transform: t.transform, filter: t.filter }}>
				{children}
			</AbsoluteFill>
			{t.flashOpacity > 0 ? (
				<AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: t.flashOpacity }} />
			) : null}
		</>
	);
};
