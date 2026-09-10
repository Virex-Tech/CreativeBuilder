"use client";

import type { CreativeSpec } from "@render/spec";

const ROLE_COLOR: Record<string, string> = {
	HOOK: "#ff7a45",
	PROBLEM: "#ffb02e",
	DEMO: "#4aa8ff",
	POINT: "#4aa8ff",
	PROOF: "#a78bfa",
	CTA: "#c6f432",
};

/**
 * Scene strip, proportional to real duration.
 *
 * Reading timing out of raw JSON is possible but slow, and pacing is the thing most often
 * wrong — a hook that runs long or a scene that drags shows up here at a glance, before
 * anyone spends a render finding out.
 */
export function Timeline({ spec }: { spec: CreativeSpec }) {
	const total = spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
	if (total === 0) return null;

	return (
		<div className="panel" style={{ padding: 12 }}>
			<div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
				<strong style={{ fontSize: 13 }}>timeline</strong>
				<span className="muted" style={{ fontSize: 12 }}>
					{(total / 1000).toFixed(1)}s · {spec.format.w}×{spec.format.h} · {spec.format.fps}fps
				</span>
			</div>

			<div style={{ display: "flex", gap: 3, height: 46 }}>
				{spec.scenes.map((scene) => {
					const pct = (scene.durationMs / total) * 100;

					return (
						<div
							key={scene.id}
							title={`${scene.id} · ${scene.role} · ${(scene.durationMs / 1000).toFixed(1)}s · ${scene.timing}`}
							style={{
								flex: `0 0 ${pct}%`,
								background: `${ROLE_COLOR[scene.role] ?? "#666"}22`,
								// A locked scene must keep its duration (it syncs to a cut or a UI
								// animation); a solid border says "do not stretch me" at a glance.
								border: `1px solid ${ROLE_COLOR[scene.role] ?? "#666"}`,
								borderStyle: scene.timing === "locked" ? "solid" : "dashed",
								borderRadius: 6,
								padding: "4px 6px",
								overflow: "hidden",
								fontSize: 11,
							}}
						>
							<div style={{ color: ROLE_COLOR[scene.role] ?? "#999", fontWeight: 700 }}>
								{scene.role}
							</div>
							<div className="muted" style={{ whiteSpace: "nowrap" }}>
								{(scene.durationMs / 1000).toFixed(1)}s · {scene.layers.length} layers
							</div>
						</div>
					);
				})}
			</div>

			<div className="row" style={{ gap: 10, marginTop: 8, fontSize: 11 }}>
				<span className="muted">contorno sólido = locked</span>
				<span className="muted">tracejado = flex (absorve mudança de duração)</span>
			</div>
		</div>
	);
}
