import tseslint from 'typescript-eslint';

export const MAX_LINES = ['error', { max: 400, skipBlankLines: false, skipComments: false }];

const DIRECTIVE_COMMENT =
  /^(eslint\b|eslint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<|globals?\b|exported\b)/;

export const COMMENT_PLUGIN = {
  rules: {
    'no-comments': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: { description: 'Disallow all comments; only functional tooling directives (eslint/`@ts-*`/triple-slash) may remain.' },
        schema: [],
        messages: { banned: 'Comments are not allowed — delete this comment. Express intent in code (names, types). Only eslint/`@ts-*`/triple-slash directive comments are permitted.' },
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          Program() {
            const text = sourceCode.getText();
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type === 'Shebang' || comment.type === 'Hashbang') continue;
              if (DIRECTIVE_COMMENT.test(comment.value.trim())) continue;
              context.report({
                node: comment,
                messageId: 'banned',
                fix(fixer) {
                  let [start, end] = comment.range;
                  let lineStart = start;
                  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart -= 1;
                  const before = text.slice(lineStart, start);
                  const isLineStart = before.trim() === '';
                  if (isLineStart) {
                    start = lineStart;
                    if (text[end] === '\n') end += 1;
                  } else {
                    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1;
                  }
                  return fixer.removeRange([start, end]);
                },
              });
            }
          },
        };
      },
    },
  },
};

export const commentPlugins = { comments: COMMENT_PLUGIN };

export const COMMENT_RULES = {
  'comments/no-comments': 'error',
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
