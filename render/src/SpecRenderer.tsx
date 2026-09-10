import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { AudioTracks } from "./layers/AudioTracks";
import { LayerRenderer } from "./layers/LayerRenderer";
import { msToFrames, type CreativeSpec } from "./spec";

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
			{spec.scenes.map((scene) => {
				const from = msToFrames(scene.startMs, fps);
				const durationInFrames = msToFrames(scene.durationMs, fps);

				return (
					<Sequence
						key={scene.id}
						from={from}
						durationInFrames={durationInFrames}
						name={`${scene.role}:${scene.id}`}
					>
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
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
