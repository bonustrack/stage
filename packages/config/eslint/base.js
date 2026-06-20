import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

export const MAX_LINES = ['error', { max: 400, skipBlankLines: false, skipComments: false }];

export const REQUIRE_JSDOC = [
  'error',
  {
    publicOnly: false,
    enableFixer: false,
    checkConstructors: false,
    checkGetters: false,
    checkSetters: false,
    require: {
      FunctionDeclaration: true,
      FunctionExpression: false,
      ArrowFunctionExpression: false,
      ClassDeclaration: false,
      ClassExpression: false,
      MethodDefinition: true,
    },
    contexts: [
      'VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
      'VariableDeclaration > VariableDeclarator > FunctionExpression',
    ],
  },
];

export const REQUIRE_FILE_OVERVIEW = [
  'error',
  { tags: { file: { initialCommentsOnly: true, mustExist: true, preventDuplicates: true } } },
];

function countCommentContentLines(value) {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*\*?/, '').trim())
    .filter((line) => line.length > 0).length;
}

const DIRECTIVE_LINE_COMMENT =
  /^(eslint\b|eslint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<)/;

export const COMMENT_PLUGIN = {
  rules: {
    'comment-max-lines': {
      meta: {
        type: 'layout',
        docs: { description: 'Limit every comment to at most `max` content lines.' },
        schema: [{ type: 'object', properties: { max: { type: 'integer', minimum: 1 } }, additionalProperties: false }],
        messages: { tooLong: 'A comment must be at most {{max}} line(s) (found {{found}}) — split it into separate one-line `/** … */` comments.' },
      },
      create(context) {
        const max = context.options[0]?.max ?? 1;
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          Program() {
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type !== 'Block') continue;
              const found = countCommentContentLines(comment.value);
              if (found > max) {
                context.report({ node: comment, messageId: 'tooLong', data: { max: String(max), found: String(found) } });
              }
            }
          },
        };
      },
    },
    'no-line-comments': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow `//` line comments; require `/** … */` block comments (directive comments excepted).' },
        schema: [],
        messages: { line: 'Use a `/** … */` block comment, not `//` (only eslint/`@ts-*`/triple-slash directive comments may stay `//`).' },
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        return {
          Program() {
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type !== 'Line') continue;
              if (DIRECTIVE_LINE_COMMENT.test(comment.value.trim())) continue;
              context.report({ node: comment, messageId: 'line' });
            }
          },
        };
      },
    },
    'no-consecutive-comments': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow two comments on consecutive lines — each comment must be standalone.' },
        schema: [],
        messages: { consecutive: 'Two comments on consecutive lines — merge them into ONE `/** … */` comment (or separate them with code).' },
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const ownLine = (c) => {
          const before = sourceCode.getTokenBefore(c, { includeComments: true });
          return !before || before.loc.end.line < c.loc.start.line;
        };
        return {
          Program() {
            const comments = sourceCode.getAllComments().filter((c) => c.type !== 'Shebang' && c.type !== 'Hashbang');
            for (let i = 1; i < comments.length; i++) {
              const prev = comments[i - 1], cur = comments[i];
              if (cur.loc.start.line !== prev.loc.end.line + 1) continue;
              if (!ownLine(prev) || !ownLine(cur)) continue;
              context.report({ node: cur, messageId: 'consecutive' });
            }
          },
        };
      },
    },
  },
};

export const jsdocPlugin = jsdoc;

export const commentPlugins = { jsdoc, comments: COMMENT_PLUGIN };

export const COMMENT_RULES = {
  'jsdoc/require-jsdoc': REQUIRE_JSDOC,
  'jsdoc/require-file-overview': REQUIRE_FILE_OVERVIEW,
  'jsdoc/no-bad-blocks': 'error',
  'comments/comment-max-lines': ['error', { max: 1 }],
  'comments/no-line-comments': 'error',
  'comments/no-consecutive-comments': 'error',
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
