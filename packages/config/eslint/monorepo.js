/** @file Single-root ESLint flat-config composer for the Stage monorepo: scopes each preset to its workspace dir and lazily gates the Vue preset behind an opt-out flag. */
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { ignores as baseIgnores, recommended, strictTsBlock, typeCheckedLanguageOptions, commentPlugins, COMMENT_RULES } from "./base.js";
import { reactNative, kitEslint } from "./react-native.js";

/** Monorepo root (two levels up) holding the workspace tsconfigs the type-aware projectService resolves. */
const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));

/** Flat-config block enabling type-aware linting for a workspace's TS/TSX files via its tsconfig, anchored at ROOT_DIR. */
function typeAwareBlock(dir, project, extraFiles = []) {
  return {
    files: [`${dir}/**/*.{ts,tsx}`, ...extraFiles],
    languageOptions: typeCheckedLanguageOptions(ROOT_DIR, project),
  };
}

/** Join a workspace dir prefix onto a single glob, preserving leading negations. */
function prefixGlob(dir, glob) {
  if (glob.startsWith("!")) return "!" + prefixGlob(dir, glob.slice(1));
  return `${dir}/${glob}`;
}

/** Copy a flat-config block with its files/ignores globs prefixed by dir, adding a files scope when the block has neither. */
function scopeBlock(dir, block) {
  const out = { ...block };
  if (Array.isArray(block.ignores)) {
    out.ignores = block.ignores.map((g) => prefixGlob(dir, g));
  }
  if (Array.isArray(block.files)) {
    out.files = block.files.map((g) => prefixGlob(dir, g));
  } else if (!Array.isArray(block.ignores)) {
    /** No files and not a global-ignore block: scope to the whole workspace so it doesn't leak to other workspaces. */
    out.files = [`${dir}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,vue}`];
  }
  return out;
}

/** Scope every block of a preset array to a workspace directory. */
function scopePreset(dir, preset) {
  return preset.map((block) => scopeBlock(dir, block));
}

/** Build the full single-root flat-config array for the monorepo; opts.vue (default true) includes the lazily-loaded apps/ui Vue block. */
export async function monorepo({ vue = true } = {}) {
  /** @type {import("eslint").Linter.Config[]} */
  const config = [
    /** Repo-wide ignores: never descend into build output or deps anywhere. */
    { ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "**/.vite/**"] },

    /** apps/app + packages/kit: RN/Kit presets, each workspace pointed at its lint tsconfig so strict-type-checked rules have type info. */
    typeAwareBlock("apps/app", "apps/app/tsconfig.eslint.json"),
    ...scopePreset("apps/app", reactNative()),
    typeAwareBlock("packages/kit", "packages/kit/tsconfig.json"),
    ...scopePreset("packages/kit", kitEslint()),

    /** Pure-TS packages/apps: base preset (type-checked recommended + strict escape-hatch bans), project supplied by the workspace-wide typeAwareBlock. */
    typeAwareBlock("apps/proxy", "apps/proxy/tsconfig.eslint.json"),
    ...scopePreset("apps/proxy", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "apps/proxy/tsconfig.eslint.json" })]),
    typeAwareBlock("packages/client", "packages/client/tsconfig.eslint.json"),
    ...scopePreset("packages/client", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "packages/client/tsconfig.eslint.json" })]),

  ];

  if (vue) {
    /** Lazy: only now are vue-eslint-parser, eslint-plugin-vue and the vue preset imported, so an RN-only lint run never touches Vue. */
    const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
      import("./vue.js"),
      import("vue-eslint-parser").then((m) => m.default ?? m),
      import("eslint-plugin-vue").then((m) => m.default ?? m),
    ]);
    /** Type-aware block for apps/ui's pure-TS sources; the .vue block carries its own vue-eslint-parser languageOptions. */
    config.push(typeAwareBlock("apps/ui", "apps/ui/tsconfig.json"));
    config.push(...scopePreset("apps/ui", vuePreset({ vueParser, vuePlugin, rootDir: ROOT_DIR, project: "apps/ui/tsconfig.json" })));
  }

  /** Turn type-aware rules OFF for toolchain JS and root config TS (syntactic strong-typing bans still apply); pushed LAST so these blocks win. */
  config.push(
    { files: ["**/*.{js,jsx,cjs,mjs}"], ...tseslint.configs.disableTypeChecked },
    { files: ["**/*.config.{ts,mts,cts}"], ...tseslint.configs.disableTypeChecked },
  );

  /** Apply the same one-line comment conventions as the TS sources to every hand-written JS file, with no per-file-type exception. */
  config.push({
    files: ["**/*.{js,jsx,cjs,mjs}"],
    plugins: commentPlugins,
    rules: { ...COMMENT_RULES },
  });

  return config;
}
