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
export const knipConfig = {
  $schema: "https://unpkg.com/knip@6/schema.json",
  workspaces: {
    "apps/app": {
      entry: [
        "app/**/*.{ts,tsx}",
        "babel.config.js",
        "modules/**/*.{ts,tsx}",
        "plugins/**/*.{js,ts}",
        "scripts/**/*.js",
        "scripts/**/*.mjs",
        "nodejs-assets/**/*.js",
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
