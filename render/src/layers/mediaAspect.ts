import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";

/**
 * Intrinsic aspect ratio (width / height) of an image or video, read in the browser.
 *
 * The phone mockup sizes its screen to the app screen it shows, so a 9:16 screenshot is not
 * cropped by a 9:19.5 screen (and vice versa). The probe holds the render with delayRender until
 * the size is known, and releases it only after React committed the new layout — so no frame is
 * ever captured with the provisional size. Results are cached per src for the life of the tab.
 * A failed probe resolves to null (the caller keeps its default) instead of failing the render.
 */
const cache = new Map<string, number | null>();

function probe(url: string, kind: "image" | "video"): Promise<number | null> {
	return new Promise((resolve) => {
		const done = (w: number, h: number) => resolve(w > 0 && h > 0 ? w / h : null);
		if (kind === "image") {
			const img = new Image();
			img.onload = () => done(img.naturalWidth, img.naturalHeight);
			img.onerror = () => resolve(null);
			img.src = url;

			return;
		}
		const video = document.createElement("video");
		video.preload = "metadata";
		video.muted = true;
		video.onloadedmetadata = () => {
			done(video.videoWidth, video.videoHeight);
			video.removeAttribute("src");
			video.load();
		};
		video.onerror = () => resolve(null);
		video.src = url;
	});
}

/** Mount the caller with `key={url}`: the probe runs once per mount (the render handle is per mount). */
export function useMediaAspect(url: string | null, kind: "image" | "video"): number | null {
	const known = url !== null && cache.has(url);
	const [state, setState] = useState<{ aspect: number | null; resolved: boolean }>(() => ({
		aspect: url !== null ? (cache.get(url) ?? null) : null,
		resolved: url === null || known,
	}));
	const [handle] = useState<number | null>(() => (url !== null && !known ? delayRender(`app screen size: ${url}`) : null));
	const released = useRef(false);
	const release = () => {
		if (handle === null || released.current) return;
		released.current = true;
		continueRender(handle);
	};

	useEffect(() => {
		if (url === null || handle === null) return;
		let alive = true;
		void probe(url, kind).then((aspect) => {
			cache.set(url, aspect);
			if (alive) setState({ aspect, resolved: true });
		});

		return () => {
			alive = false;
			// Unmounted before the probe finished: never leave the render waiting on it.
			release();
		};
	}, [url, kind, handle]);

	// Released after the commit that applied the size (effects run post-commit).
	useEffect(() => {
		if (state.resolved) release();
	}, [state.resolved]);

	return state.aspect;
}
