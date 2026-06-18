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
import { ignores as baseIgnores, recommended, strictTsBlock } from "./base.js";
import { reactNative, kitEslint } from "./react-native.js";

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

    // apps/app + packages/kit — React Native / Kit presets.
    ...scopePreset("apps/app", reactNative()),
    ...scopePreset("packages/kit", kitEslint()),

    // Pure-TypeScript packages/apps — base preset (recommended + strict TS).
    ...scopePreset("apps/api", [baseIgnores(), ...recommended, strictTsBlock()]),
    ...scopePreset("apps/proxy", [baseIgnores(), ...recommended, strictTsBlock()]),
    ...scopePreset("packages/client", [baseIgnores(), ...recommended, strictTsBlock()]),
  ];

  if (vue) {
    // Lazy: only now do vue-eslint-parser / eslint-plugin-vue / the vue preset
    // get imported, so an RN-only lint run never touches Vue.
    const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
      import("./vue.js"),
      import("vue-eslint-parser").then((m) => m.default ?? m),
      import("eslint-plugin-vue").then((m) => m.default ?? m),
    ]);
    config.push(...scopePreset("apps/ui", vuePreset({ vueParser, vuePlugin })));
  }

  return config;
}
