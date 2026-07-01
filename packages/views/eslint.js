import {
  MAX_LINES,
  recommended,
  NO_ESCAPE_HATCHES,
  commentPlugins,
  COMMENT_RULES,
  FUNCTION_SIZE_RULES,
} from '@stage-labs/config/eslint/base';

export function viewsEslint() {
  return [
    { ignores: ['node_modules/**', 'dist/**'] },
    ...recommended,
    {
      files: ['src/**/*.ts'],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        'max-lines': MAX_LINES,
      },
    },
  ];
}
