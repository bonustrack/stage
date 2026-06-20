/** @file Ambient `process.env` declaration letting the framework-agnostic API helpers read optional overrides without pulling in @types/node; Node/Expo hosts populate it, a bare browser gets it from the bundler shim (or helpers fall back to default keys). */
declare const process: {
  env: Record<string, string | undefined>;
};
