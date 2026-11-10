import { describe, expect, test } from 'bun:test';
import plugin, { lifecycleFlagKind } from '../oxlint/state.js';

const rule = plugin.rules['no-flag-lifecycle'];

interface Declarator {
  type: 'VariableDeclarator';
  id: { type: 'ArrayPattern'; elements: { type: 'Identifier'; name: string }[] };
  init: { type: 'CallExpression'; callee: { type: 'Identifier'; name: string } };
  parent: object;
}

function declarator(name: string, owner: object, hook = 'useState'): Declarator {
  return {
    type: 'VariableDeclarator',
    id: { type: 'ArrayPattern', elements: [{ type: 'Identifier', name }] },
    init: { type: 'CallExpression', callee: { type: 'Identifier', name: hook } },
    parent: { type: 'VariableDeclaration', parent: { type: 'BlockStatement', parent: owner } },
  };
}

function reportsFor(declarators: Declarator[]): string[] {
  const messages: string[] = [];
  const visitor = rule.create({ report: ({ message }: { message: string }) => messages.push(message) });
  for (const node of declarators) visitor.VariableDeclarator(node);
  return messages;
}

const component = { type: 'FunctionDeclaration' };
const other = { type: 'ArrowFunctionExpression' };

describe('lifecycleFlagKind', () => {
  test('names for work in flight and for how it ended', () => {
    expect(['busy', 'isLoading', 'saving', 'uploading'].map(lifecycleFlagKind)).toEqual(['progress', 'progress', 'progress', 'progress']);
    expect(['error', 'err', 'status', 'sent', 'saveError'].map(lifecycleFlagKind)).toEqual([
      'outcome',
      'outcome',
      'outcome',
      'outcome',
      'outcome',
    ]);
  });

  test('plain toggles and data are left alone', () => {
    expect(['open', 'hovered', 'copied', 'pending', 'draft', 'terror'].map(lifecycleFlagKind)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('no-flag-lifecycle', () => {
  test('a progress flag beside an outcome flag in one function is reported once', () => {
    const messages = reportsFor([declarator('busy', component), declarator('error', component), declarator('sent', component)]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('`busy` and `error` are one lifecycle kept in two flags');
  });

  test('either flag alone is fine', () => {
    expect(reportsFor([declarator('busy', component), declarator('open', component)])).toEqual([]);
    expect(reportsFor([declarator('error', component)])).toEqual([]);
  });

  test('flags in different functions are not paired', () => {
    expect(reportsFor([declarator('busy', component), declarator('error', other)])).toEqual([]);
  });

  test('only useState counts', () => {
    expect(reportsFor([declarator('busy', component, 'useThing'), declarator('error', component)])).toEqual([]);
  });
});
