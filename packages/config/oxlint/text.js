const EM_DASH = String.fromCharCode(0x2014);

export default {
  meta: { name: 'text' },
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
