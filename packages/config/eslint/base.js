/** @file @stage-labs/config base ESLint flat-config preset: centralised, behaviour-identical flat-config blocks consumers compose via `tseslint.config(...)`. */
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";

/** The `max-lines` rule value used everywhere: cap files at 400 lines, counting blank lines and comments. */
export const MAX_LINES = ["error", { max: 400, skipBlankLines: false, skipComments: false }];

/** REQUIRE_JSDOC: every named function/method and every const/let/var-bound arrow or function expression needs a non-empty JSDoc description (inline callbacks and trivial accessors/constructors exempt). */
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

/** REQUIRE_FILE_OVERVIEW: every file must open with a `@file` JSDoc header (mustExist, initialCommentsOnly, preventDuplicates), itself capped at one line. */
export const REQUIRE_FILE_OVERVIEW = [
  "error",
  { tags: { file: { initialCommentsOnly: true, mustExist: true, preventDuplicates: true } } },
];

/** Count the non-empty content lines of a block-comment value (leading `*` stripped) so delimiter and blank lines do not count toward the cap. */
function countCommentContentLines(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/, "").trim())
    .filter((line) => line.length > 0).length;
}

/** DIRECTIVE_LINE_COMMENT: the only `//` comments that survive the ban — eslint, `@ts-*`, triple-slash, tslint, prettier-ignore, and istanbul/c8/v8 coverage pragmas. */
const DIRECTIVE_LINE_COMMENT =
  /^(eslint\b|eslint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<)/;

/** STAGE_PLUGIN: local `stage` plugin with bespoke comment rules — comment-max-lines (one-line cap), no-line-comments (block-only, directives excepted), and no-consecutive-comments (no adjacent comments). */
export const STAGE_PLUGIN = {
  rules: {
    "comment-max-lines": {
      meta: {
        type: "layout",
        docs: { description: "Limit every comment to at most `max` content lines." },
        schema: [{ type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false }],
        messages: { tooLong: "A comment must be at most {{max}} line(s) (found {{found}}) — split it into separate one-line `/** … */` comments." },
      },
      /** Build the comment-max-lines rule listener that flags over-long block comments. */
      create(context) {
        const max = context.options[0]?.max ?? 1;
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          /** Report every block comment whose content-line count exceeds `max`. */
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
      /** Build the no-line-comments rule listener that flags non-directive `//` comments. */
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          /** Report every non-directive `//` line comment. */
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
      /** Build the no-consecutive-comments rule listener that flags two own-line comments on adjacent lines. */
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        /** True when the comment is own-line (no token precedes it on its line); trailing comments after code are exempt. */
        const ownLine = (c) => {
          const before = sourceCode.getTokenBefore(c, { includeComments: true });
          return !before || before.loc.end.line < c.loc.start.line;
        };
        return {
          /** Report each own-line comment that sits directly below another own-line comment. */
          Program() {
            /** Drop the `#!` hashbang: it is an interpreter directive, must be line 1, and can't be a block comment — so it never counts as one of an adjacent pair. */
            const comments = sourceCode.getAllComments().filter((c) => c.type !== "Shebang" && c.type !== "Hashbang");
            for (let i = 1; i < comments.length; i++) {
              const prev = comments[i - 1], cur = comments[i];
              if (cur.loc.start.line !== prev.loc.end.line + 1) continue; /** not adjacent lines */
              if (!ownLine(prev) || !ownLine(cur)) continue; /** a trailing comment is exempt */
              context.report({ node: cur, messageId: "consecutive" });
            }
          },
        };
      },
    },
  },
};

/** The eslint-plugin-jsdoc plugin object, re-exported so presets register the same instance. */
export const jsdocPlugin = jsdoc;

/** The plugin map every comment-enforcing block must register: the jsdoc plugin plus the local `stage` plugin. */
export const commentPlugins = { jsdoc, stage: STAGE_PLUGIN };

/** The full comment-convention rule set shared by every preset: JSDoc per function, `@file` header, no bad blocks, one-line comments, block-only, no adjacent comments. */
export const COMMENT_RULES = {
  "jsdoc/require-jsdoc": REQUIRE_JSDOC,
  "jsdoc/require-file-overview": REQUIRE_FILE_OVERVIEW,
  "jsdoc/no-bad-blocks": "error",
  "stage/comment-max-lines": ["error", { max: 1 }],
  "stage/no-line-comments": "error",
  "stage/no-consecutive-comments": "error",
};

/** The `max-lines-per-function` value used everywhere: cap a function at 100 lines, skipping blanks/comments, and count IIFEs. */
export const MAX_LINES_PER_FUNCTION = ["error", { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true }];

/** The `complexity` value used everywhere: cap a function's cyclomatic complexity at 10. */
export const COMPLEXITY = ["error", 10];

/** The shared function-size rule set spread into every preset: cap each function at 100 lines and complexity 10. */
export const FUNCTION_SIZE_RULES = {
  "max-lines-per-function": MAX_LINES_PER_FUNCTION,
  complexity: COMPLEXITY,
};

/** typescript-eslint's type-aware `strict-type-checked` + `stylistic-type-checked` flat configs, re-exported so every preset spreads the same presets. */
export const recommended = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  /** Final override turning off three pure code-style type-checked rules (restrict-template-expressions, no-unnecessary-condition, no-deprecated) to avoid cosmetic, behaviour-adjacent churn while the strong-typing contract stays error. */
  {
    name: "@stage-labs/config/type-checked-style-opt-outs",
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-deprecated": "off",
    },
  },
];

/** Build languageOptions that turn on type-aware linting, anchored at `tsconfigRootDir`, using explicit `project` paths or else `projectService` auto-discovery. */
export function typeCheckedLanguageOptions(tsconfigRootDir, project) {
  return {
    parser: tseslint.parser,
    parserOptions: project
      ? { project, tsconfigRootDir }
      : { projectService: true, tsconfigRootDir },
  };
}

/** Escape-hatch bans shared by every preset: no-explicit-any, ban-ts-comment (only described `@ts-expect-error` allowed), and no-non-null-assertion. */
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

/** The non-type-aware recommended preset, kept for `.js`/`.cjs` build-config files outside any tsconfig include. */
export const recommendedUntyped = tseslint.configs.recommended;

/** Build the default ignore globs shared by the pure-TS packages/apps, merging any `extra` package-specific globs. */
export function ignores(extra = []) {
  return { ignores: ["node_modules/**", "dist/**", ...extra] };
}

/** Build the shared "strict TS" block: type-aware linting, escape-hatch bans, file-length cap, and the comment/function-size rules for the given `files`. */
export function strictTsBlock({ files = ["src/**/*.{ts,tsx}"], tsconfigRootDir, project } = {}) {
  return {
    files,
    languageOptions: typeCheckedLanguageOptions(tsconfigRootDir, project),
    plugins: commentPlugins,
    rules: {
      /** Strong typing: ban `any` plus the type-system escape hatches. */
      ...NO_ESCAPE_HATCHES,
      /** Cap files at 400 lines. */
      "max-lines": MAX_LINES,
      /** Comment conventions: one JSDoc per function, one line each, `@file` header, block comments only. */
      ...COMMENT_RULES,
      /** Function size: cap each function at 100 lines (skipping blanks/comments) and complexity 10. */
      ...FUNCTION_SIZE_RULES,
    },
  };
}
