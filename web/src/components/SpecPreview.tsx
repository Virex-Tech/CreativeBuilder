"use client";

import { Player } from "@remotion/player";

import { SpecRenderer } from "@render/SpecRenderer";
import { msToFrames, specDurationMs, type CreativeSpec } from "@render/spec";

/**
 * Live preview of a spec, in the browser.
 *
 * This runs the SAME component the render service renders with — not a lookalike. That is
 * the whole point: an approximation would drift from the MP4 and quietly teach the team to
 * distrust the preview, which is worse than having no preview at all.
 *
 * It also costs nothing. A render burns CPU and minutes; scrubbing here is free, so the
 * expensive render only happens once the timing is already right.
 */
export function SpecPreview({ spec }: { spec: CreativeSpec }) {
	const durationInFrames = Math.max(1, msToFrames(specDurationMs(spec), spec.format.fps));

	return (
		<Player
			component={SpecRenderer}
			inputProps={{ spec }}
			durationInFrames={durationInFrames}
			fps={spec.format.fps}
			compositionWidth={spec.format.w}
			compositionHeight={spec.format.h}
			style={{ width: "100%", borderRadius: 10, overflow: "hidden", background: "#000" }}
			controls
			// Loop: a 16s creative is watched dozens of times while tuning a hook, and
			// clicking play again every pass is friction that adds up.
			loop
			acknowledgeRemotionLicense
		/>
	);
}
