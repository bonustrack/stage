/** Minimal ambient declaration so the framework-agnostic API helpers can read
 *  optional `process.env.*` overrides without pulling in @types/node. Hosts that
 *  run under Node / Expo populate these; in a bare browser `process` is provided
 *  by the bundler shim (or the helpers just fall back to their default keys). */
declare const process: {
  env: Record<string, string | undefined>;
};
