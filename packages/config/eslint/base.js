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

// REQUIRE_FILE_OVERVIEW — every file must open with a `@file` JSDoc block
// (`/** @file … */`). `mustExist` makes a missing header an error;
// `initialCommentsOnly` requires it at the very top; `preventDuplicates` bans a
// second `@file`. Like every other comment, the header is capped at ONE line by
// `stage/comment-max-lines` (below) — there is no multi-line exemption.
export const REQUIRE_FILE_OVERVIEW = [
  "error",
  { tags: { file: { initialCommentsOnly: true, mustExist: true, preventDuplicates: true } } },
];

/** Count the non-empty content lines of a block-comment value (the text between
 *  the `/*` and `*\/`, with the leading `*` of each line stripped), so the
 *  `/**` and `*\/` delimiter lines and blank lines do not count toward the cap. */
function countCommentContentLines(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/, "").trim())
    .filter((line) => line.length > 0).length;
}

// DIRECTIVE_LINE_COMMENT — the ONLY `//` line comments that survive the
// `no-line-comments` ban. These carry machine-read directives that MUST stay
// line comments: eslint inline disables, TypeScript `@ts-*` pragmas, triple-slash
// `/// <reference …>` (its value is `/ <reference …>`), tslint, prettier-ignore,
// and the coverage pragmas (istanbul / c8 / v8). Tested against the comment's
// trimmed text (the part after `//`).
const DIRECTIVE_LINE_COMMENT =
  /^(eslint\b|eslint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<)/;

// STAGE_PLUGIN — the local plugin holding the monorepo's bespoke comment rules
// (the ones no stock jsdoc/eslint rule covers). Registered under the `stage`
// namespace, so consumers reference its rules as `stage/<rule>`:
//
//   - comment-max-lines: caps EVERY comment at `max` content lines (default 1).
//     It scans every block comment (`/* … */` / `/** … */`, the `@file` header
//     included — there is no exemption) and reports when its content-line count
//     exceeds `max`. Line comments are inherently one line, so only blocks are
//     checked. Split a long note into separate one-line `/** … */` comments.
//   - no-line-comments: bans `//` line comments outright — every comment must be
//     a `/** … */` block — except the machine-read directives in
//     DIRECTIVE_LINE_COMMENT (eslint/`@ts-*`/triple-slash/…), which must stay `//`.
//   - no-consecutive-comments: bans two own-line comments on adjacent lines, so a
//     stack of comments must be merged into ONE one-line `/** … */`.
export const STAGE_PLUGIN = {
  rules: {
    "comment-max-lines": {
      meta: {
        type: "layout",
        docs: { description: "Limit every comment to at most `max` content lines." },
        schema: [{ type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false }],
        messages: { tooLong: "A comment must be at most {{max}} line(s) (found {{found}}) — split it into separate one-line `/** … */` comments." },
      },
      create(context) {
        const max = context.options[0]?.max ?? 1;
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          Program() {
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type !== "Block") continue;
              const found = countCommentContentLines(comment.value);
              if (found > max) {
                context.report({ node: comment, messageId: "tooLong", data: { max: String(max), found: String(found) } });
              }
            }
          },
        };
      },
    },
    "no-line-comments": {
      meta: {
        type: "suggestion",
        docs: { description: "Disallow `//` line comments; require `/** … */` block comments (directive comments excepted)." },
        schema: [],
        messages: { line: "Use a `/** … */` block comment, not `//` (only eslint/`@ts-*`/triple-slash directive comments may stay `//`)." },
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          Program() {
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type !== "Line") continue;
              if (DIRECTIVE_LINE_COMMENT.test(comment.value.trim())) continue;
              context.report({ node: comment, messageId: "line" });
            }
          },
        };
      },
    },
    "no-consecutive-comments": {
      meta: {
        type: "suggestion",
        docs: { description: "Disallow two comments on consecutive lines — each comment must be standalone." },
        schema: [],
        messages: { consecutive: "Two comments on consecutive lines — merge them into ONE `/** … */` comment (or separate them with code)." },
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        // A comment is "own-line" when no token precedes it on its own line — so a
        // trailing comment after code (`foo(); /** x */`) never counts as one of a
        // back-to-back pair. Only two OWN-LINE comments on adjacent lines are banned.
        const ownLine = (c) => {
          const before = sourceCode.getTokenBefore(c, { includeComments: true });
          return !before || before.loc.end.line < c.loc.start.line;
        };
        return {
          Program() {
            const comments = sourceCode.getAllComments();
            for (let i = 1; i < comments.length; i++) {
              const prev = comments[i - 1], cur = comments[i];
              if (cur.loc.start.line !== prev.loc.end.line + 1) continue; // not adjacent lines
              if (!ownLine(prev) || !ownLine(cur)) continue; // a trailing comment is exempt
              context.report({ node: cur, messageId: "consecutive" });
            }
          },
        };
      },
    },
  },
};

/** The eslint-plugin-jsdoc plugin object, re-exported so the react-native and
 *  vue presets register the same instance in their own flat-config blocks. */
export const jsdocPlugin = jsdoc;

/** The plugin map every comment-enforcing block must register: the jsdoc plugin
 *  plus the local `stage` plugin that owns the one-line comment cap and the
 *  `//`-line-comment ban. */
export const commentPlugins = { jsdoc, stage: STAGE_PLUGIN };

/** The full comment-convention rule set shared by every preset: require a JSDoc
 *  comment on every function, require a `@file` header, reject malformed blocks,
 *  cap EVERY comment (the `@file` header included) at one line, ban `//` line
 *  comments so every comment is a one-line JSDoc block (eslint / `@ts-*` /
 *  triple-slash directives excepted), and forbid two comments on adjacent lines
 *  so each comment stands alone. */
export const COMMENT_RULES = {
  "jsdoc/require-jsdoc": REQUIRE_JSDOC,
  "jsdoc/require-file-overview": REQUIRE_FILE_OVERVIEW,
  "jsdoc/no-bad-blocks": "error",
  "stage/comment-max-lines": ["error", { max: 1 }],
  "stage/no-line-comments": "error",
  "stage/no-consecutive-comments": "error",
};

/** The `max-lines-per-function` value used everywhere: cap a single function at
 *  100 lines. `skipBlankLines` + `skipComments` mean the JSDoc/`@file` headers
 *  and blank lines a function carries do NOT count toward the limit (so the
 *  comment-convention rules above never push a function over the cap), and
 *  `IIFEs: true` counts immediately-invoked function expressions too. Extract a
 *  helper / split the logic rather than crossing it. */
export const MAX_LINES_PER_FUNCTION = ["error", { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true }];

/** The `complexity` value used everywhere: cap a function's cyclomatic
 *  complexity at 10 (a sane default). Split branchy logic into smaller,
 *  separately-testable functions rather than crossing it. */
export const COMPLEXITY = ["error", 10];

/** The shared function-size rule set spread into every preset (alongside
 *  COMMENT_RULES): cap each function at 100 lines and cyclomatic complexity 10. */
export const FUNCTION_SIZE_RULES = {
  "max-lines-per-function": MAX_LINES_PER_FUNCTION,
  complexity: COMPLEXITY,
};

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
    plugins: commentPlugins,
    rules: {
      // Strong typing: ban `any` + the type-system escape hatches (ts-comment,
      // non-null `!`). Use `unknown` + narrowing, real interfaces, generics, or
      // library types instead.
      ...NO_ESCAPE_HATCHES,
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": MAX_LINES,
      // Comment conventions: 1 JSDoc per function, 1 line each, `@file` header
      // on every file (capped at 3 lines), `/** */` blocks only.
      ...COMMENT_RULES,
      // Function size: cap each function at 100 lines (skipping blanks/comments)
      // and cyclomatic complexity at 10. Extract helpers rather than crossing.
      ...FUNCTION_SIZE_RULES,
    },
  };
}
