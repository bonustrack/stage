// @stage-labs/config — Vue ESLint flat-config preset (for apps/ui and any
// future Vue packages). This is the exact config that was inlined in
// apps/ui/eslint.config.mjs, relocated unchanged. It does NOT include the
// base `no-explicit-any` ban — apps/ui never had it, and the goal is zero
// change in lint results.
//
// vue-eslint-parser and eslint-plugin-vue are the consumer's own deps and are
// passed in, so this package never pins those versions.
import tseslint from "typescript-eslint";
import { MAX_LINES, REQUIRE_EXPORTED_JSDOC, jsdocPlugin } from "./base.js";

/**
 * Build the Vue flat-config array.
 * @param {object}   opts
 * @param {*}        opts.vueParser  the `vue-eslint-parser` module
 * @param {*}        opts.vuePlugin  the `eslint-plugin-vue` module
 * @returns flat-config array to spread into `tseslint.config(...)`
 */
export function vue({ vueParser, vuePlugin }) {
  return [
    // Generated declaration files are not linted: auto-imports.d.ts and
    // components.d.ts are emitted by unplugin-auto-import / unplugin-vue-components.
    {
      ignores: [
        "node_modules/**",
        "dist/**",
        ".vite/**",
        "src/auto-imports.d.ts",
        "src/components.d.ts",
      ],
    },
    ...tseslint.configs.recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: { jsdoc: jsdocPlugin },
      rules: {
        "max-lines": MAX_LINES,
        // Every exported function/method needs a leading JSDoc description.
        "jsdoc/require-jsdoc": REQUIRE_EXPORTED_JSDOC,
      },
    },
    {
      files: ["src/**/*.vue"],
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser: tseslint.parser,
          ecmaVersion: "latest",
          sourceType: "module",
          extraFileExtensions: [".vue"],
        },
      },
      plugins: { vue: vuePlugin },
      rules: {
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
      },
    },
  ];
}
