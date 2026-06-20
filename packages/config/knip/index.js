/** @file Shared knip preset for the Stage bun-workspace monorepo, centralising per-workspace entry/project globs and ignore-dependency lists for the BLOCKING CI knip check. */

/** The shared knip configuration for the monorepo (bun workspaces). */
const knipConfig = {
  $schema: "https://unpkg.com/knip@6/schema.json",
  /** An export consumed within its own defining file is not dead code; only exports with no reference anywhere are reported. */
  ignoreExportsUsedInFile: true,
  workspaces: {
    /** Repo root: CI/preview scripts under scripts/ are invoked from shell and GitHub Actions YAML, so list them as entrypoints. */
    ".": {
      entry: ["scripts/**/*.{mjs,js,sh}"],
      project: ["scripts/**/*.{mjs,js}"],
    },
    "apps/app": {
      /** The nodejs-assets/nodejs-project tree is a separate embedded Node package excluded from the Metro bundle and intentionally kept out of `project`, so its deps are out of scope here. */
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
        /** Build/config-time only deps knip can't trace to a runtime import (resolved natively or via require.resolve / JSDoc `@type` imports). */
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
    /** Shared config package: its presets are consumed by the root configs (not import-reachable from app entries), so list them as entries to avoid false unused-file reports. */
    "packages/config": {
      entry: ["eslint/*.js"],
      project: ["**/*.js"],
    },
  },
};

export default knipConfig;
