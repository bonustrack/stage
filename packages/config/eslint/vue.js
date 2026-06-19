// @stage-labs/config — Vue ESLint flat-config preset (for apps/ui and any
// future Vue packages). This is the exact config that was inlined in
// apps/ui/eslint.config.mjs, relocated unchanged. It does NOT include the
// base `no-explicit-any` ban — apps/ui never had it, and the goal is zero
// change in lint results.
//
// vue-eslint-parser and eslint-plugin-vue are the consumer's own deps and are
// passed in, so this package never pins those versions.
import tseslint from "typescript-eslint";
import { MAX_LINES, REQUIRE_JSDOC, jsdocPlugin, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from "./base.js";

/**
 * Build the Vue flat-config array.
 * @param {object}   opts
 * @param {*}        opts.vueParser  the `vue-eslint-parser` module
 * @param {*}        opts.vuePlugin  the `eslint-plugin-vue` module
 * @param {string}   opts.rootDir    monorepo root for the type-aware project lookup
 * @param {string}   opts.project    path (relative to rootDir) of the lint tsconfig
 * @returns flat-config array to spread into `tseslint.config(...)`
 */
export function vue({ vueParser, vuePlugin, rootDir, project }) {
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
    // Type-checked strict preset for the pure-TS sources (NOT .vue — those are
    // type-checked through the vue-eslint-parser block below). projectService is
    // wired by the monorepo composer's workspace-wide type-aware block.
    ...recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: commentPlugins,
      rules: {
        // Strong typing: ban `any` + the type-system escape hatches.
        ...NO_ESCAPE_HATCHES,
        "max-lines": MAX_LINES,
        // Comment conventions: 1 JSDoc per function, 1 line each, `@file` header
        // on every file (capped at 3 lines), `/** */` blocks only.
        ...COMMENT_RULES,
        // Function size: cap each function at 100 lines (skipping blanks/comments)
        // and cyclomatic complexity at 15. Extract helpers rather than crossing.
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
        // Strong typing in <script> blocks too: ban `any` + escape hatches. These
        // are syntactic and work regardless of whether full type info resolves
        // for the .vue file, so the strong-typing contract holds in SFCs.
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
        // Function size: cap each function at 100 lines (skipping blanks/comments)
        // and cyclomatic complexity at 15. Extract helpers rather than crossing.
        ...FUNCTION_SIZE_RULES,
      },
    },
  ];
}
