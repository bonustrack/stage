import tseslint from "typescript-eslint";
import { MAX_LINES, REQUIRE_JSDOC, jsdocPlugin, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from "./base.js";

export function vue({ vueParser, vuePlugin, rootDir, project }) {
  return [
    {
      ignores: [
        "node_modules/**",
        "dist/**",
        ".vite/**",
        "src/auto-imports.d.ts",
        "src/components.d.ts",
      ],
    },
    ...recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        "max-lines": MAX_LINES,
        ...COMMENT_RULES,
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
        ...FUNCTION_SIZE_RULES,
      },
    },
  ];
}
