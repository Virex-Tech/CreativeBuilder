/**
 * The pure, dependency-free part of the engine — what callers need WITHOUT React/Remotion/zod.
 *
 * Built by `npm run build:lib` into `lib/engine.mjs` (committed), which `tools/spec-tool.mjs`
 * imports with plain `node`. Only add modules here that import nothing.
 */
export * from "./footage";
export * from "./formats";
export * from "./urlRewrite";
