// @stage-labs/config — shared knip preset for the Stage bun-workspace monorepo.
//
// Knip finds unused files, dependencies and exports across the workspaces. This
// preset centralises the per-workspace entry/project globs and the
// ignore-dependency lists (polyfills the RN bundler wires in implicitly, etc.)
// so the root knip.config.js stays a one-line `export default config`. It is a
// REPORTING tool: the root `knip` script surfaces findings but does not fail the
// build on pre-existing ones.
//
// Consumed from the repo root via:
//   import config from "@stage-labs/config/knip";
//   export default config;

/** The shared knip configuration for the monorepo (bun workspaces). */
const knipConfig = {
  $schema: "https://unpkg.com/knip@6/schema.json",
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
      entry: [
        "app/**/*.{ts,tsx}",
        "app.config.js",
        "babel.config.js",
        "modules/**/*.{ts,tsx}",
        "plugins/**/*.{js,ts}",
        "scripts/**/*.js",
        "scripts/**/*.mjs",
      ],
      project: ["app/**", "components/**", "lib/**", "modules/**"],
      // nodejs-assets/nodejs-project is a SEPARATE embedded Node package
      // (metro-railgun-node-host) with its own package.json; it is excluded from
      // the Metro bundle (apps/app/metro.config.js resolver.blockList) and built
      // into the native binary. Its deps (graphql, leveldown-nodejs-mobile,
      // rn-bridge, @railgun-privacy/native-prover) are declared there, not in
      // apps/app, so it must not be scanned as part of this workspace.
      ignore: ["nodejs-assets/**"],
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
    "apps/api": {
      project: ["src/**"],
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
