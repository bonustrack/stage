import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';

export default tseslint.config(
  // Generated declaration files are not linted: auto-imports.d.ts and
  // components.d.ts are emitted by unplugin-auto-import / unplugin-vue-components.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.vite/**',
      'src/auto-imports.d.ts',
      'src/components.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: { vue: vuePlugin },
    rules: {
      ...vuePlugin.configs['flat/recommended'][0].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attribute-hyphenation': 'off',
      'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
    },
  },
);
