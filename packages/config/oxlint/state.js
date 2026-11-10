const PROGRESS = /^(is)?(busy|loading|saving|sending|submitting|creating|uploading|working|checking|verifying|connecting|paying|signing)$/i;
const OUTCOME = /^(error|err|failed|status|hint|sent|done|result|problem|\w+(Error|Err))$/;
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

export function lifecycleFlagKind(name) {
  if (PROGRESS.test(name)) return 'progress';
  return OUTCOME.test(name) ? 'outcome' : null;
}

function stateName(node) {
  const callee = node.init && node.init.type === 'CallExpression' ? node.init.callee : null;
  const hook = callee && (callee.type === 'Identifier' ? callee.name : callee.property && callee.property.name);
  if (hook !== 'useState' || node.id.type !== 'ArrayPattern') return null;
  const first = node.id.elements[0];
  return first && first.type === 'Identifier' ? first.name : null;
}

function enclosingFunction(node) {
  let current = node.parent;
  while (current && !FUNCTIONS.has(current.type)) current = current.parent;
  return current;
}

const noFlagLifecycle = {
  meta: {
    type: 'problem',
    docs: { description: 'A lifecycle is one named state, not a progress useState beside an outcome useState.' },
    schema: [],
  },
  create(context) {
    const seen = new WeakMap();
    return {
      VariableDeclarator(node) {
        const name = stateName(node);
        const kind = name === null ? null : lifecycleFlagKind(name);
        const owner = kind === null ? null : enclosingFunction(node);
        if (!owner) return;
        const flags = seen.get(owner) ?? {};
        seen.set(owner, flags);
        flags[kind] ??= name;
        if (flags.reported || !flags.progress || !flags.outcome) return;
        flags.reported = true;
        context.report({
          node,
          message:
            `\`${flags.progress}\` and \`${flags.outcome}\` are one lifecycle kept in two flags. ` +
            'Model it as a single state moved by a pure (state, event) => state function, so impossible combinations can not be stored.',
        });
      },
    };
  },
};

export default { meta: { name: 'state' }, rules: { 'no-flag-lifecycle': noFlagLifecycle } };
