// GERADO por render/scripts/build.mjs (npm run build:lib) a partir de render/src/engine.ts — NÃO EDITE.
// Fonte: render/src/footage.ts, formats.ts, urlRewrite.ts. Mude lá e rode `npm run build:lib` em render/.

// src/footage.ts
var LEAD_MS = 60;
var TAIL_MS = 120;
var GAP_BREAK_MS = 350;
var MIN_CLIP_MS = 300;
var isFootage = (l) => !!l && typeof l === "object" && l.type === "footage";
var isAutoCaption = (l) => !!l && typeof l === "object" && l.type === "karaoke" && !!l.auto;
function footageTakeIds(spec) {
  const ids = /* @__PURE__ */ new Set();
  for (const scene of spec.scenes) for (const l of scene.layers) if (isFootage(l) && l.takeId) ids.add(l.takeId);
  return Array.from(ids);
}
function hasFootage(spec) {
  return spec.scenes.some((s) => s.layers.some(isFootage));
}
function normalizeTake(t) {
  const words = [];
  for (const x of t.words ?? []) {
    const raw = x;
    const w = typeof raw.w === "string" ? raw.w : typeof raw.word === "string" ? raw.word : null;
    if (w === null || typeof raw.startMs !== "number" || typeof raw.endMs !== "number") continue;
    if (!Number.isFinite(raw.startMs) || !Number.isFinite(raw.endMs)) continue;
    words.push({ w, startMs: raw.startMs, endMs: raw.endMs });
  }
  return { id: String(t.id), src: typeof t.src === "string" && t.src ? t.src : null, durationMs: Number(t.durationMs) || 0, words };
}
var wordAt = (words, ms) => words.find((w) => ms > w.startMs && ms < w.endMs);
function snapClip(scene, layer, take) {
  let inMs = layer.startFromMs ?? 0;
  let outMs = inMs + scene.durationMs;
  const words = take.words;
  const cutIn = wordAt(words, inMs);
  if (cutIn) {
    const before = words.filter((w) => w.endMs <= cutIn.startMs);
    const prev = before[before.length - 1];
    inMs = inMs - cutIn.startMs <= cutIn.endMs - inMs ? Math.max(prev?.endMs ?? 0, cutIn.startMs - LEAD_MS) : cutIn.endMs;
  }
  const cutOut = wordAt(words, outMs);
  if (cutOut) {
    if (outMs - cutOut.startMs >= cutOut.endMs - outMs) {
      const next = words.find((w) => w.startMs >= cutOut.endMs);
      outMs = Math.min(cutOut.endMs + TAIL_MS, next ? next.startMs - 20 : Infinity);
    } else {
      outMs = cutOut.startMs - 20;
    }
  }
  outMs = Math.min(outMs, take.durationMs);
  inMs = Math.min(inMs, Math.max(0, outMs - MIN_CLIP_MS));
  layer.startFromMs = Math.round(inMs);
  scene.durationMs = Math.max(MIN_CLIP_MS, Math.round(outMs - inMs));
}
var clean = (w) => w.replace(/^[,.;:!?…"“”]+|[,.;…"“”]+$/g, "");
function captionLayers(words, inMs, sceneMs, maxWords) {
  const inside = words.filter((w) => Math.min(w.endMs, inMs + sceneMs) - Math.max(w.startMs, inMs) >= Math.max(1, w.endMs - w.startMs) / 2).map((w) => ({ text: clean(w.w), start: Math.max(0, w.startMs - inMs), end: Math.min(sceneMs, w.endMs - inMs), raw: w.w })).filter((w) => w.text);
  const blocks = [];
  let cur = [];
  inside.forEach((w, i) => {
    cur.push(w);
    const next = inside[i + 1];
    const endsSentence = /[.!?…]$/.test(w.raw);
    if (!next || cur.length >= maxWords || endsSentence || next.start - w.end > GAP_BREAK_MS) {
      blocks.push(cur);
      cur = [];
    }
  });
  return blocks.map((b, i) => {
    const last = b[b.length - 1];
    const start = Math.round(b[0].start);
    const nextStart = blocks[i + 1]?.[0].start;
    const end = Math.round(nextStart !== void 0 && nextStart - last.end < GAP_BREAK_MS ? nextStart : last.end + 150);
    return {
      type: "karaoke",
      auto: true,
      text: b.map((w) => w.text).join(" "),
      startMs: start,
      durationMs: Math.max(200, Math.min(sceneMs - start, end - start)),
      wordEndsMs: b.map((w) => Math.max(1, Math.round(w.end - start)))
    };
  });
}
function reflow(spec) {
  let cursor = 0;
  for (const scene of spec.scenes) {
    scene.startMs = cursor;
    cursor += scene.durationMs;
  }
  return cursor;
}
function finalizeFootage(input, takesIn) {
  const spec = JSON.parse(JSON.stringify(input));
  const warnings = [];
  if (!Array.isArray(spec.scenes)) return { spec, warnings: ["spec sem scenes"], stats: { clips: 0, captionBlocks: 0, durationMs: 0 } };
  if (!hasFootage(spec)) {
    const durationMs2 = spec.scenes.reduce((end, s) => Math.max(end, s.startMs + s.durationMs), 0);
    return { spec, warnings, stats: { clips: 0, captionBlocks: 0, durationMs: durationMs2 } };
  }
  const takes = takesIn.map(normalizeTake).filter((t) => t.durationMs > 0);
  const byId = new Map(takes.map((t) => [t.id, t]));
  const bySrc = new Map(takes.filter((t) => t.src).map((t) => [t.src, t]));
  const takeOf = (l) => (l.takeId ? byId.get(l.takeId) : void 0) ?? bySrc.get(l.src);
  const auto = spec.autoCaptions ?? { enabled: true };
  const captionsOn = auto.enabled !== false;
  const maxWords = auto.maxWords ?? 4;
  const mains = [];
  for (const scene of spec.scenes) {
    for (const l of scene.layers) {
      if (!isFootage(l)) continue;
      const byTakeId = l.takeId ? byId.get(l.takeId) : void 0;
      if (byTakeId?.src) l.src = byTakeId.src;
      if (typeof l.startFromMs === "number") l.startFromMs = Math.max(0, Math.round(l.startFromMs));
    }
    scene.layers = scene.layers.filter((l) => !isAutoCaption(l));
    const main = scene.layers.find((l) => isFootage(l) && !l.startMs && !l.durationMs);
    if (!main) continue;
    const take = takeOf(main);
    if (!take) {
      warnings.push(`cena ${scene.id}: take ${main.takeId ? `"${main.takeId}"` : `"${main.src}"`} desconhecido \u2014 clipe sem acabamento`);
      continue;
    }
    if (!take.words.length) warnings.push(`cena ${scene.id}: take "${take.id}" sem transcri\xE7\xE3o \u2014 sem legenda da fala`);
    snapClip(scene, main, take);
    mains.push({ scene, layer: main, take });
  }
  for (let i = 0; i + 1 < mains.length; i++) {
    const a = mains[i];
    const b = mains[i + 1];
    if (a.take !== b.take || spec.scenes.indexOf(b.scene) !== spec.scenes.indexOf(a.scene) + 1) continue;
    const aIn = a.layer.startFromMs ?? 0;
    const bIn = b.layer.startFromMs ?? 0;
    if (bIn >= aIn && aIn + a.scene.durationMs > bIn) a.scene.durationMs = Math.max(MIN_CLIP_MS, bIn - aIn);
  }
  let captionBlocks = 0;
  for (const { scene, layer, take } of mains) {
    if (captionsOn && (layer.volume ?? 1) > 0 && take.words.length) {
      const caps = captionLayers(take.words, layer.startFromMs ?? 0, scene.durationMs, maxWords);
      scene.layers.push(...caps);
      captionBlocks += caps.length;
    }
  }
  if (!spec.autoCaptions) spec.autoCaptions = { enabled: true, maxWords };
  const durationMs = reflow(spec);
  return { spec, warnings, stats: { clips: mains.length, captionBlocks, durationMs } };
}

// src/formats.ts
var FORMAT_SIZES = {
  /** 9:16 — Reels, TikTok, Stories, Shorts. */
  VERTICAL: { w: 1080, h: 1920 },
  /** 4:5 — feed. */
  PORTRAIT: { w: 1080, h: 1350 },
  /** 1:1 — feed / carousel. */
  SQUARE: { w: 1080, h: 1080 }
};
var FORMAT_NAMES = Object.keys(FORMAT_SIZES);
function isFormatName(value) {
  return typeof value === "string" && value in FORMAT_SIZES;
}
function withFormat(spec, name) {
  const size = FORMAT_SIZES[name];
  if (!size) throw new Error(`formato desconhecido: ${String(name)} (use ${FORMAT_NAMES.join(" | ")})`);
  return { ...spec, format: { ...spec.format, w: size.w, h: size.h } };
}
function formatOf(w, h) {
  return FORMAT_NAMES.find((n) => FORMAT_SIZES[n].w === w && FORMAT_SIZES[n].h === h) ?? null;
}
var BASE_W = 1080;
var BASE_H = 1920;
var FULL_SIZE_MIN_H = 1350;
var SAFE_BOTTOM = 420;
var SAFE_TOP = 230;
function layoutFor(w, h) {
  const s = Math.min(w / BASE_W, h / FULL_SIZE_MIN_H);
  const v = h / BASE_H;
  const hx = w / BASE_W;
  return {
    w,
    h,
    s,
    // Multiplying by exactly 1 keeps 9:16 values bit-identical to the old constants.
    size: (px) => px * s,
    y: (px) => px * v,
    bottom: (px) => SAFE_BOTTOM * v + (px - SAFE_BOTTOM) * s,
    top: (px) => SAFE_TOP * v + (px - SAFE_TOP) * s,
    x: (px) => px * hx
  };
}
var BASE_LAYOUT = layoutFor(BASE_W, BASE_H);

// src/urlRewrite.ts
function parseRewriteRules(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const i = part.indexOf("=>");
    const from = i === -1 ? "" : part.slice(0, i).trim();
    const to = i === -1 ? "" : part.slice(i + 2).trim();
    if (!from || !to) throw new Error(`RENDER_URL_REWRITE inv\xE1lido: "${part}" (formato: de=>para;de2=>para2)`);
    return { from, to };
  });
}
function rewriteUrl(src, rules) {
  for (const r of rules) if (src.startsWith(r.from)) return r.to + src.slice(r.from.length);
  return src;
}
var fix = (o, rules) => o && typeof o.src === "string" ? { ...o, src: rewriteUrl(o.src, rules) } : o;
function rewriteSpecUrls(spec, rules) {
  if (rules.length === 0) return spec;
  const audio = spec.audio;
  return {
    ...spec,
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((l) => l && typeof l === "object" ? fix(l, rules) : l)
    })),
    ...audio ? {
      audio: {
        ...audio,
        ...audio.voiceover ? { voiceover: fix(audio.voiceover, rules) } : {},
        ...audio.music ? { music: fix(audio.music, rules) } : {},
        ...Array.isArray(audio.sfx) ? { sfx: audio.sfx.map((x) => fix(x, rules)) } : {}
      }
    } : {}
  };
}
export {
  BASE_H,
  BASE_LAYOUT,
  BASE_W,
  FORMAT_NAMES,
  FORMAT_SIZES,
  GAP_BREAK_MS,
  LEAD_MS,
  SAFE_BOTTOM,
  SAFE_TOP,
  TAIL_MS,
  captionLayers,
  finalizeFootage,
  footageTakeIds,
  formatOf,
  hasFootage,
  isFormatName,
  layoutFor,
  normalizeTake,
  parseRewriteRules,
  rewriteSpecUrls,
  rewriteUrl,
  withFormat
};
