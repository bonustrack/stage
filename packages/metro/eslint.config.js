import tseslint from "typescript-eslint";

const maxCommentLines = {
  meta: { type: "suggestion", schema: [{ type: "integer", minimum: 1 }] },
  create(context) {
    const max = context.options[0] ?? 3;
    return {
      Program() {
        for (const c of context.sourceCode.getAllComments()) {
          const lines = c.loc.end.line - c.loc.start.line + 1;
          if (lines > max) {
            context.report({ node: c, message: `Comment spans ${lines} lines; max is ${max}.` });
          }
        }
      },
    };
  },
};

export default tseslint.config(
  // src/integrations/* are the runtime train scripts (xmtp/telegram/discord) —
  // self-contained, long header doc-blocks, runtime deps not in the package.
  // Already excluded from the tsc build (tsconfig `exclude`); mirror that here.
  { ignores: ["node_modules/**", "dist/**", "src/integrations/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "examples/**/*.ts"],
    plugins: { local: { rules: { "max-comment-lines": maxCommentLines } } },
    rules: {
      quotes: ["error", "single", { avoidEscape: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "max-len": ["error", { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: false, skipComments: false }],
      // `multiline-comment-style: starred-block` removed — it fought the codebase's
      // pervasive inline `/* … */` annotation style (55 false-positive errors that
      // kept CI permanently red). `local/max-comment-lines` still caps comment length.
      "local/max-comment-lines": ["error", 3],
    },
  },
  {
    // Examples are standalone reference train scripts (not shipped src): exempt them
    // from the library's structural caps + the import-style rule — they teach setup in
    // long header doc-blocks, are intentionally self-contained (one file = one train),
    // and use require() for optional deps. Correctness rules (unused vars, no-explicit-any)
    // still apply.
    files: ["examples/**/*.ts"],
    rules: {
      "local/max-comment-lines": "off",
      "max-lines": "off",
      "max-len": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
