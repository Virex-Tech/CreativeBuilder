import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";

import { resolveSrc } from "../resolveSrc";
import { dbToGain, msToFrames, msToStartFrame, type SpecAudio } from "../spec";

/**
 * Voiceover + music for the whole creative.
 *
 * Both tracks live at the composition level rather than inside scenes, because a cut must
 * never cut the narration. Scene boundaries are visual; the audio runs across them.
 */
export const AudioTracks: React.FC<{ audio?: SpecAudio }> = ({ audio }) => {
	const { fps } = useVideoConfig();
	if (!audio) return null;

	const { voiceover, music, sfx } = audio;

	const voFrom = voiceover ? msToStartFrame(voiceover.atMs, fps) : 0;
	const voEnd = voiceover?.durationMs ? voFrom + msToFrames(voiceover.durationMs, fps) : null;

	// Short ramp instead of a hard step: an instant drop is audible as a click and reads as
	// a mistake even to listeners who cannot name it.
	const RAMP = Math.max(1, Math.round(fps * 0.25));
	const duckGain = music ? dbToGain(music.duckingDb) : 1;

	const musicVolume = (frame: number): number => {
		if (!music) return 0;
		if (!voiceover) return music.volume;

		const ducked = music.volume * duckGain;
		// Ramp down as the voice comes in.
		const inRamp = Math.min(1, Math.max(0, (frame - voFrom) / RAMP));
		// ...and back up once it ends. Without a known duration the voice is assumed to run
		// to the end of the video, so the music simply stays ducked.
		const outRamp = voEnd === null ? 0 : Math.min(1, Math.max(0, (frame - voEnd) / RAMP));
		const duckAmount = Math.max(0, inRamp - outRamp);

		return music.volume + (ducked - music.volume) * duckAmount;
	};

	return (
		<>
			{voiceover ? (
				<Sequence from={voFrom} durationInFrames={voEnd ? voEnd - voFrom : undefined}>
					<Audio
						src={resolveSrc(voiceover.src)}
						volume={voiceover.volume}
						trimBefore={
							voiceover.startFromMs ? msToFrames(voiceover.startFromMs, fps) : undefined
						}
					/>
				</Sequence>
			) : null}

			{music ? (
				<Audio
					src={resolveSrc(music.src)}
					trimBefore={music.startFromMs ? msToFrames(music.startFromMs, fps) : undefined}
					volume={musicVolume}
				/>
			) : null}

			{sfx?.map((fx, i) => (
				// One-shot effects sit at absolute timeline positions, independent of scenes — a
				// whoosh belongs to the cut, not to either scene it sits between.
				<Sequence key={`sfx-${String(i)}`} from={msToStartFrame(fx.atMs, fps)}>
					<Audio src={resolveSrc(fx.src)} volume={fx.volume} />
				</Sequence>
			))}
		</>
	);
};
