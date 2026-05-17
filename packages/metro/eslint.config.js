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
  { ignores: ["node_modules/**", "dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: { local: { rules: { "max-comment-lines": maxCommentLines } } },
    rules: {
      quotes: ["error", "single", { avoidEscape: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "max-len": ["error", { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      "max-lines": ["error", { max: 250 }],
      "multiline-comment-style": ["error", "starred-block"],
      "local/max-comment-lines": ["error", 3],
    },
  },
);
