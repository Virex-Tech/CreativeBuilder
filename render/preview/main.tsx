import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { SpecRenderer } from "../src/SpecRenderer";
import { creativeSpec, msToFrames, specDurationMs, type CreativeSpec } from "../src/spec";

/**
 * creative-engine preview page (GET /preview/) — the SAME SpecRenderer the MP4 is rendered with,
 * in @remotion/player, driven by the parent window over postMessage. Protocol: README.md
 * ("Preview no navegador").
 */

declare global {
	interface Window {
		__CE_CONFIG__?: { allowedOrigins?: string[] };
	}
}

// Relative `src` in a spec (e.g. "app/x/tela.png") resolves to ./public/ next to this page — which
// is the service's public/ folder, the same files a server-side render reads. Works under a prefix.
window.remotion_staticBase = new URL("public", document.baseURI).pathname.replace(/\/+$/, "");

const configured = (window.__CE_CONFIG__?.allowedOrigins ?? []).filter(Boolean);
const ANY = configured.includes("*");
// Nothing configured = same origin only. "*" only when explicitly set.
const ALLOWED = configured.length ? configured.filter((o) => o !== "*") : [window.location.origin];

const isAllowed = (origin: string): boolean => ANY || ALLOWED.includes(origin);

type Outgoing =
	| { type: "creative-engine:ready" }
	| { type: "creative-engine:loaded"; durationMs: number; width: number; height: number; fps: number }
	| { type: "creative-engine:error"; issues: string[] }
	| { type: "creative-engine:time"; ms: number };

const controller = window.parent !== window ? window.parent : window.opener ? (window.opener as Window) : null;
/** Origin of the last accepted message: replies go there, and only there. */
let replyOrigin: string | null = null;

function post(msg: Outgoing): void {
	if (!controller) return;
	if (replyOrigin) {
		controller.postMessage(msg, replyOrigin);

		return;
	}
	// Before the parent spoke (the "ready" handshake): every allowed origin, "*" only if opted in.
	for (const origin of ANY ? ["*"] : ALLOWED) controller.postMessage(msg, origin);
}

const TIME_EVERY_MS = 250;

const App: React.FC = () => {
	const [spec, setSpec] = useState<CreativeSpec | null>(null);
	const ref = useRef<PlayerRef>(null);
	const specRef = useRef<CreativeSpec | null>(null);
	specRef.current = spec;

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (!isAllowed(event.origin)) return;
			if (controller && event.source !== controller) return;
			const data = event.data as { type?: unknown; spec?: unknown; ms?: unknown } | null;
			if (!data || typeof data.type !== "string" || !data.type.startsWith("creative-engine:")) return;
			replyOrigin = event.origin;

			const player = ref.current;
			const current = specRef.current;
			switch (data.type) {
				case "creative-engine:spec": {
					const parsed = creativeSpec.safeParse(data.spec);
					if (!parsed.success) {
						post({
							type: "creative-engine:error",
							issues: parsed.error.issues.slice(0, 12).map((i) => `${i.path.map(String).join(".")}: ${i.message}`),
						});

						return;
					}
					setSpec(parsed.data);
					post({
						type: "creative-engine:loaded",
						durationMs: specDurationMs(parsed.data),
						width: parsed.data.format.w,
						height: parsed.data.format.h,
						fps: parsed.data.format.fps,
					});

					return;
				}
				case "creative-engine:seek":
					if (player && current && typeof data.ms === "number" && Number.isFinite(data.ms)) {
						const last = Math.max(0, msToFrames(specDurationMs(current), current.format.fps) - 1);
						player.seekTo(Math.max(0, Math.min(last, Math.round((data.ms / 1000) * current.format.fps))));
					}

					return;
				case "creative-engine:play":
					if (!player) return;
					try {
						player.play();
					} catch {
						// Autoplay policy: without a user gesture, sound blocks playback — play muted.
						player.mute();
						player.play();
					}

					return;
				case "creative-engine:pause":
					player?.pause();

					return;
				default:
			}
		};
		window.addEventListener("message", onMessage);
		post({ type: "creative-engine:ready" });

		return () => window.removeEventListener("message", onMessage);
	}, []);

	useEffect(() => {
		const player = ref.current;
		if (!player || !spec) return;
		const fps = spec.format.fps;
		let last = 0;
		const send = (frame: number) => post({ type: "creative-engine:time", ms: Math.round((frame / fps) * 1000) });
		const onFrame = ({ detail }: { detail: { frame: number } }) => {
			if (!player.isPlaying()) return;
			const now = Date.now();
			if (now - last < TIME_EVERY_MS) return;
			last = now;
			send(detail.frame);
		};
		const onSeeked = ({ detail }: { detail: { frame: number } }) => send(detail.frame);
		const onPause = () => send(player.getCurrentFrame());
		player.addEventListener("frameupdate", onFrame);
		player.addEventListener("seeked", onSeeked);
		player.addEventListener("pause", onPause);

		return () => {
			player.removeEventListener("frameupdate", onFrame);
			player.removeEventListener("seeked", onSeeked);
			player.removeEventListener("pause", onPause);
		};
	}, [spec]);

	if (!spec) {
		return (
			<div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
				aguardando spec…
			</div>
		);
	}

	return (
		<Player
			ref={ref}
			component={SpecRenderer}
			inputProps={{ spec }}
			durationInFrames={Math.max(1, msToFrames(specDurationMs(spec), spec.format.fps))}
			fps={spec.format.fps}
			compositionWidth={spec.format.w}
			compositionHeight={spec.format.h}
			// Fills the iframe; the Player letterboxes to keep the spec's aspect ratio.
			style={{ width: "100%", height: "100%", background: "#111113" }}
			controls
			loop
			clickToPlay
			acknowledgeRemotionLicense
		/>
	);
};

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
