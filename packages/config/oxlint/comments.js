const DIRECTIVE_COMMENT =
  /^(eslint\b|eslint-|oxlint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<|globals?\b|exported\b)/;

export default {
  meta: { name: 'comments' },
  rules: {
    'no-comments': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: { description: 'Disallow all comments; only functional tooling directives (eslint/`@ts-*`/triple-slash) may remain.' },
        schema: [],
        messages: { banned: 'Comments are not allowed: delete this comment. Express intent in code (names, types). Only eslint/`@ts-*`/triple-slash directive comments are permitted.' },
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
