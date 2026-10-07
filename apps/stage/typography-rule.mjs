import { createTypographyAst } from './typography-ast.mjs';

const KIT_TEXT = '@stage-labs/kit/react-native/text';
const KIT_TOKENS = '@stage-labs/kit/tokens';
const SIZE_KEYS = new Set(['fontSize', 'font-size', 'font']);
const STYLE_KEYS = new Set(['style', 'textStyle']);

function tokenValidator(ast) {
  const cache = new WeakMap();
  return function isToken(node) {
    node = ast.resolve(node);
    if (!node) return false;
    if (cache.has(node)) return cache.get(node);
    cache.set(node, false);
    let valid = false;
    if (node.type === 'MemberExpression') valid = ast.imported(node.object, KIT_TOKENS, 'FONT_SIZE');
    if (node.type === 'CallExpression') valid = ast.imported(node.callee, KIT_TOKENS, 'fontSize');
    if (node.type === 'ConditionalExpression') valid = isToken(node.consequent) && isToken(node.alternate);
    cache.set(node, valid);
    return valid;
  };
}

function sizeInspector(ast) {
  const cache = { style: new WeakMap(), props: new WeakMap() };
  function propertyHasSize(property, mode) {
    if (property.type === 'SpreadElement') return inspect(property.argument, mode);
    const key = ast.key(property.key, property.computed);
    if (SIZE_KEYS.has(key)) return true;
    return mode === 'props' && STYLE_KEYS.has(key) && inspect(property.value, 'style');
  }
  function inspect(node, mode) {
    node = ast.resolve(node);
    if (!node) return false;
    if (cache[mode].has(node)) return cache[mode].get(node);
    cache[mode].set(node, false);
    const found = inspectValue(node, mode);
    cache[mode].set(node, found);
    return found;
  }
  function inspectValue(node, mode) {
    const alternatives = ast.branches(node);
    if (alternatives) return alternatives.some(value => inspect(value, mode));
    if (node.type === 'ObjectExpression') return node.properties.some(property => propertyHasSize(property, mode));
    if (node.type === 'ArrayExpression') return node.elements.some(value => inspect(value, mode));
    return false;
  }
  return {
    style: node => inspect(node, 'style'),
    props: node => inspect(node, 'props'),
  };
}

function kitTextAttribute(attr, ast, sizes) {
  if (attr.type === 'JSXSpreadAttribute') return sizes.props(attr.argument);
  const key = ast.key(attr.name);
  return SIZE_KEYS.has(key) || (STYLE_KEYS.has(key) && sizes.style(attr.value?.expression));
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'use named Kit font sizes in app source and the size prop on Kit Text' },
    schema: [],
    messages: {
      token: 'Use a named Kit font size (FONT_SIZE or fontSize from @stage-labs/kit/tokens), not a custom size. Define semantic typography inside Kit.',
      text: 'Kit Text must use its size prop, not a fontSize style override.',
      css: 'Do not define font sizes in app CSS strings. Use Kit typography components.',
    },
  },
  create(context) {
    const ast = createTypographyAst(context);
    const isToken = tokenValidator(ast);
    const sizes = sizeInspector(ast);
    const checkSize = (node, key, value) => {
      if (SIZE_KEYS.has(key) && (key !== 'fontSize' || !isToken(value))) context.report({ node, messageId: 'token' });
    };
    const checkCss = (node, value) => {
      if (typeof value === 'string' && /(?:^|[;{}])\s*font(?:-size)?\s*:/i.test(value)) context.report({ node, messageId: 'css' });
    };
    return {
      Property(node) {
        if (node.parent.type === 'ObjectExpression') checkSize(node, ast.key(node.key, node.computed), node.value);
      },
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;
        checkSize(node, ast.key(node.left.property, node.left.computed), node.operator === '=' ? node.right : undefined);
      },
      UpdateExpression(node) {
        if (node.argument.type === 'MemberExpression') checkSize(node, ast.key(node.argument.property, node.argument.computed));
      },
      JSXAttribute(node) {
        checkSize(node, ast.key(node.name), node.value?.expression ?? node.value);
      },
      Literal(node) { checkCss(node, node.value); },
      TemplateElement(node) { checkCss(node, node.value.cooked ?? node.value.raw); },
      JSXOpeningElement(node) {
        if (!ast.imported(node.name, KIT_TEXT, 'Text')) return;
        for (const attr of node.attributes) {
          if (kitTextAttribute(attr, ast, sizes)) context.report({ node: attr, messageId: 'text' });
        }
      },
    };
  },
};
