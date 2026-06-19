// @stage-labs/config — shared knip preset for the Stage bun-workspace monorepo.
//
// Knip finds unused files, dependencies and exports across the workspaces. This
// preset centralises the per-workspace entry/project globs and the
// ignore-dependency lists (polyfills the RN bundler wires in implicitly, etc.)
// so the root knip.config.js stays a one-line `export default config`. The root
// `knip` script exits non-zero on any finding and runs as a BLOCKING step in CI
// (.github/workflows/ci.yml), so a new unused file/dep/export fails the build.
// (The non-fatal `report:deps` script is for local pre-flight only.)
//
// Consumed from the repo root via:
//   import config from "@stage-labs/config/knip";
//   export default config;

/** The shared knip configuration for the monorepo (bun workspaces). */
const knipConfig = {
  $schema: "https://unpkg.com/knip@6/schema.json",
  // An export consumed within its OWN defining file is not dead code — it's a
  // module-internal helper that is ALSO part of the file's public surface (e.g.
  // a function called in-file but exported so a wiring test can assert it, like
  // zerodev/enablePasskey.ts `deployAndSwapToPasskey`). Don't flag those; only
  // exports with no reference anywhere (in-file or cross-file) are reported.
  ignoreExportsUsedInFile: true,
  workspaces: {
    // Repo root: CI/preview scripts under scripts/ are invoked from shell
    // scripts and GitHub Actions YAML (which knip can't parse), so list them as
    // entrypoints. `generate-manifest.mjs` is run by
    // scripts/pr-preview/publish-selfhosted.sh; `eas-deeplink.mjs` from the
    // pr-preview/main-preview workflows.
    ".": {
      entry: ["scripts/**/*.{mjs,js,sh}"],
      project: ["scripts/**/*.{mjs,js}"],
    },
    "apps/app": {
      // app.config.js is picked up by knip's default entry patterns. The
      // nodejs-assets/nodejs-project tree is a SEPARATE embedded Node package
      // (metro-railgun-node-host, its own package.json) excluded from the Metro
      // bundle (metro.config.js resolver.blockList); it is intentionally NOT in
      // `project` below, so its deps (graphql, leveldown-nodejs-mobile,
      // rn-bridge, @railgun-privacy/native-prover) are out of scope here.
      entry: [
        "app/**/*.{ts,tsx}",
        "babel.config.js",
        "modules/**/*.{ts,tsx}",
        "plugins/**/*.{js,ts}",
        "scripts/**/*.js",
        "scripts/**/*.mjs",
      ],
      project: ["app/**", "components/**", "lib/**", "modules/**"],
      ignoreDependencies: [
        "buffer",
        "crypto-browserify",
        "path-browserify",
        "querystring-es3",
        "react-native-url-polyfill",
        "readable-stream",
        "stream-browserify",
        "babel-preset-expo",
        // Build/config-time only deps knip can't trace to a runtime import:
        // resolved from the native side or referenced by `require.resolve` /
        // JSDoc `@type` imports in config + plugin files.
        "expo-system-ui",
        "@railgun-privacy/native-prover",
        "node-gyp-build-mobile",
      ],
    },
    "apps/ui": {
      entry: ["index.html"],
      project: ["src/**"],
      vite: true,
      vue: true,
    },
    "packages/client": {
      entry: ["src/**/*.ts"],
      project: ["src/**"],
    },
    "packages/kit": {
      project: ["src/**"],
    },
    // The shared config package: its eslint/knip/madge presets are consumed by
    // the root configs (not import-reachable from app entry points), so list its
    // exported preset files as entries to avoid false "unused file" reports.
    "packages/config": {
      entry: ["eslint/*.js"],
      project: ["**/*.js"],
    },
  },
};

export default knipConfig;
