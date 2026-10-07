function definition(node, context) {
  if (!node || !['Identifier', 'JSXIdentifier'].includes(node.type)) return undefined;
  for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name);
    if (variable) return variable.defs.length === 1 ? variable.defs[0] : undefined;
  }
  return undefined;
}

function unwrap(node) {
  while (node && ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
  return node;
}

function member(object, key) {
  return { type: 'MemberExpression', object, computed: true, property: { type: 'Literal', value: key } };
}

function branches(node) {
  if (node?.type === 'ConditionalExpression') return [node.consequent, node.alternate];
  if (node?.type === 'LogicalExpression') return [node.left, node.right];
  return undefined;
}

function literalKey(node) {
  if (node?.type === 'Literal') return String(node.value);
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value.cooked;
  return undefined;
}

function resolve(node, state) {
  node = unwrap(node);
  if (!node || state.resolving.has(node)) return undefined;
  if (state.resolved.has(node)) return state.resolved.get(node);
  state.resolving.add(node);
  const value = resolveValue(node, state);
  state.resolving.delete(node);
  state.resolved.set(node, value);
  return value;
}

function key(node, computed, state) {
  if (!computed && node?.name) return node.name;
  return literalKey(resolve(node, state));
}

function isNamespace(node, source, state) {
  const def = definition(resolve(node, state), state.context);
  return def?.type === 'ImportBinding' && def.node.type === 'ImportNamespaceSpecifier' && def.parent.source.value === source;
}

function imported(node, source, name, state) {
  node = resolve(node, state);
  if (!node) return false;
  if (['MemberExpression', 'JSXMemberExpression'].includes(node.type)) {
    return key(node.property, node.computed, state) === name && isNamespace(node.object, source, state);
  }
  const def = definition(node, state.context);
  return def?.type === 'ImportBinding' && def.parent.source.value === source && key(def.node.imported, false, state) === name;
}

function objectProperty(node, name, state) {
  for (const property of [...node.properties].reverse()) {
    if (property.type === 'SpreadElement') {
      const value = project(property.argument, name, state);
      if (value) return value;
    } else if (key(property.key, property.computed, state) === name) {
      return resolve(property.value, state);
    }
  }
  return undefined;
}

function project(node, name, state) {
  node = resolve(node, state);
  if (!node || name === undefined) return undefined;
  if (!state.projected.has(node)) state.projected.set(node, new Map());
  const cache = state.projected.get(node);
  if (cache.has(name)) return cache.get(name);
  cache.set(name, undefined);
  const value = projectValue(node, name, state);
  cache.set(name, value);
  return value;
}

function projectValue(node, name, state) {
  const alternatives = branches(node);
  if (alternatives) {
    const [left, right] = alternatives.map(value => project(value, name, state));
    return { type: 'ConditionalExpression', consequent: left, alternate: right };
  }
  if (node.type === 'ObjectExpression') return objectProperty(node, name, state);
  if (node.type === 'ArrayExpression') return resolve(node.elements[Number(name)], state);
  return member(node, name);
}

function binding(pattern, value, name, state) {
  if (pattern.type === 'Identifier') return pattern.name === name ? value : undefined;
  if (pattern.type === 'AssignmentPattern') return binding(pattern.left, value, name, state);
  if (pattern.type === 'ObjectPattern') return objectBinding(pattern, value, name, state);
  if (pattern.type === 'ArrayPattern') return arrayBinding(pattern, value, name, state);
  return undefined;
}

function arrayBinding(pattern, value, name, state) {
  for (const [index, item] of pattern.elements.entries()) {
    const match = item && binding(item, project(value, String(index), state), name, state);
    if (match) return match;
  }
  return undefined;
}

function objectBinding(pattern, value, name, state) {
  for (const property of pattern.properties) {
    if (property.type !== 'Property') continue;
    const match = binding(property.value, project(value, key(property.key, property.computed, state), state), name, state);
    if (match) return match;
  }
  return undefined;
}

function resolveCall(node, state) {
  const callee = unwrap(node.callee);
  if (callee?.type !== 'MemberExpression') return node;
  if (!['create', 'flatten'].includes(key(callee.property, callee.computed, state))) return node;
  return imported(callee.object, 'react-native', 'StyleSheet', state) ? resolve(node.arguments[0], state) : node;
}

function resolveValue(node, state) {
  const def = definition(node, state.context);
  if (def?.type === 'Variable' && def.parent.kind === 'const') {
    return resolve(binding(def.node.id, def.node.init, node.name, state), state);
  }
  if (node.type === 'MemberExpression') return project(node.object, key(node.property, node.computed, state), state);
  if (node.type === 'CallExpression') return resolveCall(node, state);
  return node;
}

export function createTypographyAst(context) {
  const state = { context, resolved: new WeakMap(), resolving: new WeakSet(), projected: new WeakMap() };
  return {
    resolve: node => resolve(node, state),
    key: (node, computed = false) => key(node, computed, state),
    imported: (node, source, name) => imported(node, source, name, state),
    branches,
  };
}
