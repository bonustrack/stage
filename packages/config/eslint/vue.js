/** @file Vue ESLint flat-config preset for apps/ui, relocated unchanged from apps/ui/eslint.config.mjs with vue-eslint-parser and eslint-plugin-vue injected by the consumer. */
import tseslint from "typescript-eslint";
import { MAX_LINES, REQUIRE_JSDOC, jsdocPlugin, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from "./base.js";

/** Build the Vue flat-config array from the injected vueParser/vuePlugin, monorepo rootDir and lint tsconfig project. */
export function vue({ vueParser, vuePlugin, rootDir, project }) {
  return [
    /** Generated declaration files are not linted: auto-imports.d.ts and components.d.ts are emitted by the unplugin tooling. */
    {
      ignores: [
        "node_modules/**",
        "dist/**",
        ".vite/**",
        "src/auto-imports.d.ts",
        "src/components.d.ts",
      ],
    },
    /** Type-checked strict preset for the pure-TS sources; .vue files are type-checked through the vue-eslint-parser block below. */
    ...recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: commentPlugins,
      rules: {
        /** Strong typing: ban `any` plus the type-system escape hatches. */
        ...NO_ESCAPE_HATCHES,
        "max-lines": MAX_LINES,
        /** Comment conventions: one JSDoc per function, one line each, `@file` header per file, block comments only. */
        ...COMMENT_RULES,
        /** Function size: cap each function at 100 lines (excluding blanks/comments) and cyclomatic complexity at 15. */
        ...FUNCTION_SIZE_RULES,
      },
    },
    {
      files: ["src/**/*.vue"],
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser: tseslint.parser,
          project,
          tsconfigRootDir: rootDir,
          ecmaVersion: "latest",
          sourceType: "module",
          extraFileExtensions: [".vue"],
        },
      },
      plugins: { vue: vuePlugin, "@typescript-eslint": tseslint.plugin, jsdoc: jsdocPlugin },
      rules: {
        /** Strong typing in <script> blocks too: syntactic `any`/escape-hatch bans that hold in SFCs regardless of type-info resolution. */
        ...NO_ESCAPE_HATCHES,
        ...vuePlugin.configs["flat/recommended"][0].rules,
        "vue/multi-word-component-names": "off",
        "vue/no-multiple-template-root": "off",
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
        "vue/html-self-closing": "off",
        "vue/attributes-order": "off",
        "vue/html-indent": "off",
        "vue/html-closing-bracket-newline": "off",
        "vue/first-attribute-linebreak": "off",
        "vue/attribute-hyphenation": "off",
        "max-lines": MAX_LINES,
        /** Function size: cap each function at 100 lines (excluding blanks/comments) and cyclomatic complexity at 15. */
        ...FUNCTION_SIZE_RULES,
      },
    },
  ];
}
