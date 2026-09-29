import tseslint from 'typescript-eslint';
import { COMMENT_PLUGIN, TEXT_PLUGIN } from './plugins.js';

export { COMMENT_PLUGIN, TEXT_PLUGIN };

export const MAX_LINES = ['error', { max: 400, skipBlankLines: false, skipComments: false }];

export const commentPlugins = { comments: COMMENT_PLUGIN, text: TEXT_PLUGIN };

export const COMMENT_RULES = {
  'comments/no-comments': 'error',
  'text/no-em-dash': 'error',
};

export const MAX_LINES_PER_FUNCTION = ['error', { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true }];

export const COMPLEXITY = ['error', 10];

export const FUNCTION_SIZE_RULES = {
  'max-lines-per-function': MAX_LINES_PER_FUNCTION,
  complexity: COMPLEXITY,
};

export const QUOTES = ['error', 'single', { avoidEscape: true }];

export const recommended = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    name: '@stage-labs/config/style',
    rules: {
      quotes: QUOTES,
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
];

export function typeCheckedLanguageOptions(tsconfigRootDir, project) {
  return {
    parser: tseslint.parser,
    parserOptions: project
      ? { project, tsconfigRootDir }
      : { projectService: true, tsconfigRootDir },
  };
}

export const NO_ESCAPE_HATCHES = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-expect-error': { descriptionFormat: '^: .{10,}$' },
      minimumDescriptionLength: 10,
    },
  ],
  '@typescript-eslint/no-non-null-assertion': 'error',
};

export const recommendedUntyped = tseslint.configs.recommended;

export function ignores(extra = []) {
  return { ignores: ['node_modules/**', 'dist/**', ...extra] };
}

export function strictTsBlock({ files = ['src/**/*.{ts,tsx}'], tsconfigRootDir, project } = {}) {
  return {
    files,
    languageOptions: typeCheckedLanguageOptions(tsconfigRootDir, project),
    plugins: commentPlugins,
    rules: {
      ...NO_ESCAPE_HATCHES,
      'max-lines': MAX_LINES,
      ...COMMENT_RULES,
      ...FUNCTION_SIZE_RULES,
    },
  };
}
