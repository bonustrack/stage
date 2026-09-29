const DIRECTIVE_COMMENT =
  /^(eslint\b|eslint-|oxlint-|@ts-|tslint:|prettier-ignore|istanbul\b|c8\b|v8\b|@jsxImportSource\b|\/\s*<|globals?\b|exported\b)/;

export const COMMENT_PLUGIN = {
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

const EM_DASH = String.fromCharCode(0x2014);

export const TEXT_PLUGIN = {
  rules: {
    'no-em-dash': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow the em dash in source text: copy uses a period, comma or colon instead.' },
        schema: [],
        messages: { banned: 'Do not use the em dash. Split the sentence or use a comma or colon.' },
      },
      create(context) {
        const check = (node, value) => {
          if (typeof value === 'string' && value.includes(EM_DASH)) context.report({ node, messageId: 'banned' });
        };
        return {
          Literal(node) { check(node, node.value); },
          TemplateElement(node) { check(node, node.value.cooked ?? node.value.raw); },
          JSXText(node) { check(node, node.value); },
        };
      },
    },
  },
};
