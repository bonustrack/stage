// @stage-labs/config — base ESLint flat-config preset.
//
// This centralises the rules that were previously duplicated, byte-for-byte,
// across the pure-TypeScript packages/apps (packages/client, apps/api,
// apps/proxy) and that the react-native / vue presets build on. It changes NO
// behaviour: it only relocates the exact same flat-config blocks.
//
// Consumers compose the exported pieces with `tseslint.config(...)`, e.g.:
//
//   import tseslint from "typescript-eslint";
//   import { ignores, recommended, strictTsBlock } from "@stage-labs/config/eslint/base";
//   export default tseslint.config(ignores(), ...recommended, strictTsBlock());
//
// `tseslint` is passed in by the consumer (it is the consumer's own
// dependency / version) so this package never pins the toolchain version.
import tseslint from "typescript-eslint";

/** The `max-lines` rule value used everywhere: cap files at 400 lines,
 *  counting blank lines and comments. Split a file rather than crossing it. */
export const MAX_LINES = ["error", { max: 400, skipBlankLines: false, skipComments: false }];

/** typescript-eslint's recommended flat config. Re-exported so consumers spread
 *  the exact same preset (`...recommended`) the inline configs used. */
export const recommended = tseslint.configs.recommended;

/** The default ignore globs shared by the pure-TS packages/apps. Pass extra
 *  globs to merge package-specific generated files (e.g. heroicons.data.ts). */
export function ignores(extra = []) {
  return { ignores: ["node_modules/**", "dist/**", ...extra] };
}

/** The shared "strict TS" block applied to `src/**` in packages/client,
 *  apps/api and apps/proxy: ban `any` and cap file length. Override `files`
 *  for packages whose sources live elsewhere. */
export function strictTsBlock({ files = ["src/**/*.{ts,tsx}"] } = {}) {
  return {
    files,
    rules: {
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": MAX_LINES,
    },
  };
}
