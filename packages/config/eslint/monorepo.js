// @stage-labs/config — single-root ESLint flat-config composer for the Stage
// monorepo.
//
// This is the ONE config the repo root references (root eslint.config.mjs runs
// `monorepo()`), replacing the six per-workspace eslint.config.mjs files. It
// produces the exact same flat-config blocks those files produced, but with
// every `files` / `ignores` glob prefixed by the owning workspace directory so a
// single `eslint .` run from the repo root applies each preset only to its own
// workspace — lint results stay byte-for-byte identical to the per-workspace
// setup.
//
// RN/Vue separation: the react-native and base presets are imported eagerly; the
// Vue preset (and, with it, vue-eslint-parser / eslint-plugin-vue) is imported
// LAZILY and ONLY when the apps/ui block is built. Linting an RN/TS-only subset
// (e.g. `eslint apps/app`) still loads zero Vue dependencies because flat-config
// blocks whose `files` never match are still constructed — so the Vue import is
// gated behind an opt-out flag and, by default, deferred via dynamic import that
// resolves the optional peer deps; if they are absent the Vue block is simply
// omitted.
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { ignores as baseIgnores, recommended, strictTsBlock, typeCheckedLanguageOptions } from "./base.js";
import { reactNative, kitEslint } from "./react-native.js";

/** The monorepo root (two levels up from packages/config/eslint/): the dir that
 *  holds the workspace tsconfigs the type-aware `projectService` resolves. */
const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));

/** A flat-config block that turns ON type-aware linting for every TS/TSX file in
 *  a workspace, so the `strict-type-checked` rules spread from `recommended`
 *  have type information. `project` is the workspace's `tsconfig.eslint.json`
 *  (relative to ROOT_DIR) — it includes src + tests + config files so EVERY
 *  lintable file resolves to a real project. `ROOT_DIR` anchors the lookup. */
function typeAwareBlock(dir, project, extraFiles = []) {
  return {
    files: [`${dir}/**/*.{ts,tsx}`, ...extraFiles],
    languageOptions: typeCheckedLanguageOptions(ROOT_DIR, project),
  };
}

/** Join a workspace dir prefix onto a single glob, leaving negations (`!`) and
 *  already-absolute/`**`-anchored globs handled correctly. */
function prefixGlob(dir, glob) {
  if (glob.startsWith("!")) return "!" + prefixGlob(dir, glob.slice(1));
  return `${dir}/${glob}`;
}

/** Return a copy of a flat-config block with its `files` and `ignores` globs
 *  prefixed by `dir`. A block with ONLY `ignores` (a global ignore) stays a
 *  global ignore — its globs are still prefixed so it only ignores within the
 *  workspace. Blocks without `files`/`ignores` (e.g. tseslint recommended) get a
 *  `files` scope added so they apply only inside the workspace. */
function scopeBlock(dir, block) {
  const out = { ...block };
  if (Array.isArray(block.ignores)) {
    out.ignores = block.ignores.map((g) => prefixGlob(dir, g));
  }
  if (Array.isArray(block.files)) {
    out.files = block.files.map((g) => prefixGlob(dir, g));
  } else if (!Array.isArray(block.ignores)) {
    // No files and not a global-ignore block (e.g. tseslint recommended): scope
    // it to the whole workspace so it doesn't leak to other workspaces.
    out.files = [`${dir}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,vue}`];
  }
  return out;
}

/** Scope every block of a preset array to a workspace directory. */
function scopePreset(dir, preset) {
  return preset.map((block) => scopeBlock(dir, block));
}

/**
 * Build the full single-root flat-config array for the monorepo.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.vue=true]  include the apps/ui Vue block (lazily loads
 *   vue-eslint-parser + eslint-plugin-vue + the vue preset). Set false to lint
 *   an RN/TS-only subset with zero Vue dependencies loaded.
 * @returns {Promise<import("eslint").Linter.Config[]>}
 */
export async function monorepo({ vue = true } = {}) {
  /** @type {import("eslint").Linter.Config[]} */
  const config = [
    // Repo-wide ignores: never descend into build output or deps anywhere.
    { ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "**/.vite/**", "packages/config/**"] },

    // apps/app + packages/kit — React Native / Kit presets. The type-aware block
    // points each workspace at its lint tsconfig (src + tests + config) so the
    // strict-type-checked rules (spread inside the presets) have type info for
    // every lintable file.
    typeAwareBlock("apps/app", "apps/app/tsconfig.eslint.json"),
    ...scopePreset("apps/app", reactNative()),
    typeAwareBlock("packages/kit", "packages/kit/tsconfig.eslint.json"),
    ...scopePreset("packages/kit", kitEslint()),

    // Pure-TypeScript packages/apps — base preset (type-checked recommended +
    // strict TS escape-hatch bans). The workspace-wide typeAwareBlock supplies
    // the project; strictTsBlock re-states it for its own src/** block.
    typeAwareBlock("apps/proxy", "apps/proxy/tsconfig.eslint.json"),
    ...scopePreset("apps/proxy", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "apps/proxy/tsconfig.eslint.json" })]),
    typeAwareBlock("packages/client", "packages/client/tsconfig.eslint.json"),
    ...scopePreset("packages/client", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "packages/client/tsconfig.eslint.json" })]),

  ];

  if (vue) {
    // Lazy: only now do vue-eslint-parser / eslint-plugin-vue / the vue preset
    // get imported, so an RN-only lint run never touches Vue.
    const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
      import("./vue.js"),
      import("vue-eslint-parser").then((m) => m.default ?? m),
      import("eslint-plugin-vue").then((m) => m.default ?? m),
    ]);
    // Type-aware block for apps/ui's pure-TS sources (the .vue block carries its
    // own vue-eslint-parser languageOptions, so only .ts/.tsx need this).
    config.push(typeAwareBlock("apps/ui", "apps/ui/tsconfig.eslint.json"));
    config.push(...scopePreset("apps/ui", vuePreset({ vueParser, vuePlugin, rootDir: ROOT_DIR, project: "apps/ui/tsconfig.eslint.json" })));
  }

  // TYPE-aware rules OFF for files that are NOT part of any app tsconfig and run
  // in the Node build toolchain, not the app:
  //   - all `.js/.jsx/.cjs/.mjs` (metro.config.js, expo config plugins, postcss
  //     config, embed.js, …) — JS, never type-checked here;
  //   - workspace-root `*.config.{ts,mts,cts}` (vite/tailwind configs).
  // The syntactic strong-typing bans (no-explicit-any, ban-ts-comment,
  // no-non-null-assertion) STILL apply. Standard typescript-eslint mechanism,
  // not a per-file dodge of app code. Pushed LAST so these blocks win over every
  // workspace's type-aware block (including the lazily-pushed Vue blocks).
  config.push(
    { files: ["**/*.{js,jsx,cjs,mjs}"], ...tseslint.configs.disableTypeChecked },
    { files: ["**/*.config.{ts,mts,cts}"], ...tseslint.configs.disableTypeChecked },
  );

  return config;
}
