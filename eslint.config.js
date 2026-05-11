import { readdirSync } from "node:fs";
import { basename, dirname } from "node:path";
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

/** A folder that contains only one source file is just indirection — flatten it into the parent. */
const noSingleFileFolder = {
  meta: { type: "suggestion", schema: [] },
  create(context) {
    return {
      Program(node) {
        const dir = dirname(context.filename);
        const name = basename(dir);
        if (name === "src") return;
        let entries;
        try { entries = readdirSync(dir).filter(e => !e.startsWith(".")); }
        catch { return; }
        if (entries.length === 1) {
          context.report({ node, message: `'${name}/' contains only one file — flatten it into its parent.` });
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
    plugins: { local: { rules: { "max-comment-lines": maxCommentLines, "no-single-file-folder": noSingleFileFolder } } },
    rules: {
      quotes: ["error", "single", { avoidEscape: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "max-lines": ["error", { max: 200 }],
      "multiline-comment-style": ["error", "starred-block"],
      "local/max-comment-lines": ["error", 3],
      "local/no-single-file-folder": "error",
    },
  },
);
