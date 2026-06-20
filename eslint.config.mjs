/** @file Root ESLint flat config: stage's single-root composer scoping each workspace's preset, pulling generic presets from @stage-labs/config and the app/kit-specific rules from their own folders. */
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { ignores as baseIgnores, recommended, strictTsBlock, typeCheckedLanguageOptions, commentPlugins, COMMENT_RULES } from "@stage-labs/config/eslint/base";
import { reactNative } from "./apps/app/eslint.mjs";
import { kitEslint } from "./packages/kit/eslint.js";

/** Monorepo root holding the workspace tsconfigs the type-aware projectService resolves. */
const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));

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
    out.files = [`${dir}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,vue}`];
  }
  return out;
}

/** Scope every block of a preset array to a workspace directory. */
function scopePreset(dir, preset) {
  return preset.map((block) => scopeBlock(dir, block));
}

/** Build the full single-root flat-config array for the monorepo; opts.vue (default true) includes the lazily-loaded apps/ui Vue block. */
async function buildConfig({ vue = true } = {}) {
  /** @type {import("eslint").Linter.Config[]} */
  const config = [
    { ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "**/.vite/**"] },

    typeAwareBlock("apps/app", "apps/app/tsconfig.eslint.json"),
    ...scopePreset("apps/app", reactNative()),
    typeAwareBlock("packages/kit", "packages/kit/tsconfig.json"),
    ...scopePreset("packages/kit", kitEslint()),

    typeAwareBlock("apps/proxy", "apps/proxy/tsconfig.eslint.json"),
    ...scopePreset("apps/proxy", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "apps/proxy/tsconfig.eslint.json" })]),
    typeAwareBlock("packages/client", "packages/client/tsconfig.eslint.json"),
    ...scopePreset("packages/client", [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: "packages/client/tsconfig.eslint.json" })]),

  ];

  if (vue) {
    const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
      import("@stage-labs/config/eslint/vue"),
      import("vue-eslint-parser").then((m) => m.default ?? m),
      import("eslint-plugin-vue").then((m) => m.default ?? m),
    ]);
    config.push(typeAwareBlock("apps/ui", "apps/ui/tsconfig.json"));
    config.push(...scopePreset("apps/ui", vuePreset({ vueParser, vuePlugin, rootDir: ROOT_DIR, project: "apps/ui/tsconfig.json" })));
  }

  config.push(
    { files: ["**/*.{js,jsx,cjs,mjs}"], ...tseslint.configs.disableTypeChecked },
    { files: ["**/*.config.{ts,mts,cts}"], ...tseslint.configs.disableTypeChecked },
  );

  config.push({
    files: ["**/*.{js,jsx,cjs,mjs}"],
    ignores: ["packages/config/**"],
    plugins: commentPlugins,
    rules: { ...COMMENT_RULES },
  });

  return config;
}

export default await buildConfig();
