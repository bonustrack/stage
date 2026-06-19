// @stage-labs/config — base ESLint flat-config preset.
//
// This centralises the rules that were previously duplicated, byte-for-byte,
// across the pure-TypeScript packages/apps (packages/client, apps/proxy) and
// that the react-native / vue presets build on. It changes NO
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

// REQUIRE_JSDOC — EVERY function needs a leading JSDoc/description comment, not
// just exported ones. Uses eslint-plugin-jsdoc's `require-jsdoc` with
// `publicOnly: false`, so the rule fires regardless of whether a function is
// reachable through an `export`:
//   - every named `function` declaration (top-level or nested);
//   - every class method;
//   - every arrow-function / function-expression bound to a name via a
//     `const`/`let`/`var` declarator (the "named function" shape), exported or
//     not, at module scope or nested.
// Bare anonymous callbacks passed inline as call/JSX arguments (e.g.
// `arr.map(x => x + 1)`, `tabBarIcon: ({color}) => <Icon/>`) are intentionally
// NOT required to carry JSDoc — a doc comment can't be placed on them cleanly
// and they are implementation detail of their enclosing (already-documented)
// function. That is why `FunctionExpression`/`ArrowFunctionExpression` stay off
// under `require` (which would flag those inline forms) and are instead matched
// via `contexts` only when bound to a declarator.
// Only a non-empty description is required — `require` does NOT force
// @param/@returns tags, so a single `/** … */` line satisfies the rule.
// Trivial accessors/constructors stay exempt (checkConstructors/checkGetters/
// checkSetters all false).
export const REQUIRE_JSDOC = [
  "error",
  {
    publicOnly: false,
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
      "VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
      "VariableDeclaration > VariableDeclarator > FunctionExpression",
    ],
  },
];

/** The eslint-plugin-jsdoc plugin object, re-exported so the react-native and
 *  vue presets register the same instance in their own flat-config blocks. */
export const jsdocPlugin = jsdoc;

/** typescript-eslint's `strict-type-checked` + `stylistic-type-checked` flat
 *  configs. These are the TYPE-AWARE presets: they need type information, which
 *  the consumer supplies by enabling the type-checked language options (see
 *  `typeCheckedLanguageOptions`) on the matched files. `strict-type-checked`
 *  bans `any`, unsafe assignment/call/member-access/return/argument, floating
 *  promises, etc.; `stylistic-type-checked` adds low-noise stylistic
 *  type-aware rules. Re-exported so every preset spreads the SAME presets.
 *
 *  NOTE: replaces the former non-type-aware `tseslint.configs.recommended`. */
export const recommended = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // Final override block: three of the type-checked rules are pure
  // CODE-STYLE / formatting choices, NOT type-safety guarantees. The
  // strong-typing contract (no `any`, the unsafe-* family, no-non-null,
  // floating/misused promises, restrict-plus-operands, base-to-string, …) stays
  // ERROR; these three are deliberately not enforced because they generate
  // large amounts of cosmetic churn that would force behaviour-adjacent edits,
  // which conflicts with the "keep behaviour identical" requirement:
  //
  //   - restrict-template-expressions: would ban `${aNumber}` /`${aBoolean}` in
  //     template literals (a stringification-style nit, not a typing hole).
  //   - no-unnecessary-condition: flags conditions the compiler deems always
  //     truthy/falsy; with noUncheckedIndexedAccess on it mostly fires on
  //     defensive runtime guards that are correct to keep.
  //   - no-deprecated: an advisory deprecation lint; acting on it means
  //     migrating third-party APIs, i.e. behaviour changes out of scope here.
  {
    name: "@stage-labs/config/type-checked-style-opt-outs",
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-deprecated": "off",
    },
  },
];

/** Language options that turn ON type-aware linting. `tsconfigRootDir` anchors
 *  the project lookup at the repo root. When `project` is given (a path or list
 *  of tsconfig paths, relative to the root) those exact projects supply the type
 *  information — this is how a workspace points at its `tsconfig.eslint.json`
 *  (which includes src + tests + config files), so test files are type-checked
 *  too. When `project` is omitted, the `projectService` auto-discovers each
 *  file's owning `tsconfig.json`. Spread the result into the `languageOptions`
 *  of the block the type-checked rules apply to. */
export function typeCheckedLanguageOptions(tsconfigRootDir, project) {
  return {
    parser: tseslint.parser,
    parserOptions: project
      ? { project, tsconfigRootDir }
      : { projectService: true, tsconfigRootDir },
  };
}

/** Escape-hatch bans shared by every preset. These make the strong-typing
 *  contract un-dodgeable:
 *   - `no-explicit-any`: ban `any` outright (kept as the long-standing error).
 *   - `ban-ts-comment`: no `@ts-ignore` / `@ts-nocheck`; `@ts-expect-error` is
 *     allowed ONLY with a >=10-char description explaining why.
 *   - `no-non-null-assertion`: no `!` — narrow with a real runtime guard. */
export const NO_ESCAPE_HATCHES = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      "ts-ignore": true,
      "ts-nocheck": true,
      "ts-expect-error": { descriptionFormat: "^: .{10,}$" },
      minimumDescriptionLength: 10,
    },
  ],
  "@typescript-eslint/no-non-null-assertion": "error",
};

/** The non-type-aware recommended preset, kept for `.js`/`.cjs` build-config
 *  files that are NOT part of any tsconfig `include` (so they have no type
 *  information and the type-checked rules would error). */
export const recommendedUntyped = tseslint.configs.recommended;

/** The default ignore globs shared by the pure-TS packages/apps. Pass extra
 *  globs to merge package-specific generated files (e.g. heroicons.data.ts). */
export function ignores(extra = []) {
  return { ignores: ["node_modules/**", "dist/**", ...extra] };
}

/** The shared "strict TS" block applied to `src/**` in packages/client and
 *  apps/proxy: turn on type-aware linting, ban the escape hatches
 *  (`any` / ts-comment / non-null `!`), cap file length, and require a JSDoc
 *  comment on every function. `tsconfigRootDir` anchors the projectService tsconfig lookup at the
 *  repo root. Override `files` for packages whose sources live elsewhere. */
export function strictTsBlock({ files = ["src/**/*.{ts,tsx}"], tsconfigRootDir, project } = {}) {
  return {
    files,
    languageOptions: typeCheckedLanguageOptions(tsconfigRootDir, project),
    plugins: { jsdoc },
    rules: {
      // Strong typing: ban `any` + the type-system escape hatches (ts-comment,
      // non-null `!`). Use `unknown` + narrowing, real interfaces, generics, or
      // library types instead.
      ...NO_ESCAPE_HATCHES,
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": MAX_LINES,
      // Every function/method (exported or not) needs a leading JSDoc description.
      "jsdoc/require-jsdoc": REQUIRE_JSDOC,
    },
  };
}
