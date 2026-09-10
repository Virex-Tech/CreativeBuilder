import React from "react";
import { Composition } from "remotion";
import { z } from "zod";

import { SpecRenderer } from "./SpecRenderer";
import { creativeSpec, msToFrames, specDurationMs, type CreativeSpec } from "./spec";
import defaultSpec from "../specs/tapfit-treino-aleatorio.json";

/**
 * A single registered composition whose dimensions and duration are DERIVED from the spec
 * via calculateMetadata. A 4:5 image and a 9:16 video are the same composition with
 * different data — no second entry, no duplicated component tree.
 */
export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="Creative"
			component={SpecRenderer}
			schema={z.object({ spec: creativeSpec })}
			defaultProps={{ spec: defaultSpec as CreativeSpec }}
			// Placeholders; calculateMetadata replaces them from the spec.
			width={1080}
			height={1920}
			fps={30}
			durationInFrames={600}
			calculateMetadata={({ props }) => {
				const spec = creativeSpec.parse(props.spec);

				return {
					width: spec.format.w,
					height: spec.format.h,
					fps: spec.format.fps,
					durationInFrames: msToFrames(specDurationMs(spec), spec.format.fps),
					props: { spec },
				};
			}}
		/>
	);
};
