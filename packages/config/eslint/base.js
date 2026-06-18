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
import jsdoc from "eslint-plugin-jsdoc";

/** The `max-lines` rule value used everywhere: cap files at 400 lines,
 *  counting blank lines and comments. Split a file rather than crossing it. */
export const MAX_LINES = ["error", { max: 400, skipBlankLines: false, skipComments: false }];

// REQUIRE_EXPORTED_JSDOC — every EXPORTED function needs a leading
// JSDoc/description comment. Uses eslint-plugin-jsdoc's `require-jsdoc`, scoped
// to exported declarations: named exported `function`s + exported class methods
// (via `require`), and exported arrow/function-expression consts + exported
// default function/arrow (via `contexts`). `publicOnly` restricts it to things
// reachable through an `export`. Only a non-empty description is required —
// `require` does NOT force @param/@returns tags, so a single `/** … */` line
// satisfies the rule. Trivial accessors/constructors stay exempt.
export const REQUIRE_EXPORTED_JSDOC = [
  "error",
  {
    publicOnly: true,
    enableFixer: false,
    checkConstructors: false,
    checkGetters: false,
    checkSetters: false,
    require: {
      FunctionDeclaration: true,
      FunctionExpression: false,
      ArrowFunctionExpression: false,
      ClassDeclaration: false,
      ClassExpression: false,
      MethodDefinition: true,
    },
    contexts: [
      "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
      "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression",
      "ExportDefaultDeclaration > ArrowFunctionExpression",
      "ExportDefaultDeclaration > FunctionExpression",
    ],
  },
];

/** The eslint-plugin-jsdoc plugin object, re-exported so the react-native and
 *  vue presets register the same instance in their own flat-config blocks. */
export const jsdocPlugin = jsdoc;

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
    plugins: { jsdoc },
    rules: {
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": MAX_LINES,
      // Every exported function/method needs a leading JSDoc description.
      "jsdoc/require-jsdoc": REQUIRE_EXPORTED_JSDOC,
    },
  };
}
