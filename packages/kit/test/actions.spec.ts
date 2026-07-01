import { describe, expect, test } from 'bun:test';
import {
  buildDispatchedAction,
  dispatchAction,
  payloadRegistry,
  resolveBindingString,
  resolveBindings,
} from '../src/kit/actions';

describe('payloadRegistry / dispatchAction', () => {
  test('handlers receive the merged payload', () => {
    const seen: Record<string, unknown>[] = [];
    const registry = payloadRegistry({
      submit: (payload) => {
        seen.push(payload);
      },
    });
    dispatchAction(
      registry,
      { type: 'submit', payload: { a: 1, b: 'base' } },
      { b: 'form', c: true },
    );
    expect(seen).toEqual([{ a: 1, b: 'form', c: true }]);
  });

  test('missing handler -> dispatchAction returns undefined', () => {
    const registry = payloadRegistry({ known: () => undefined });
    expect(dispatchAction(registry, { type: 'unknown', payload: { x: 1 } })).toBeUndefined();
  });

  test('async handler result is passed through', async () => {
    const registry = payloadRegistry({
      go: async (payload) => {
        expect(payload).toEqual({ id: 7 });
      },
    });
    const result = dispatchAction(registry, { type: 'go' }, { id: 7 });
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});

describe('buildDispatchedAction', () => {
  test('merges formValues over payload', () => {
    expect(
      buildDispatchedAction({ type: 't', payload: { a: 1, b: 2 } }, { b: 9, c: 3 }),
    ).toEqual({ type: 't', payload: { a: 1, b: 9, c: 3 } });
  });

  test('non-record payload is dropped', () => {
    expect(buildDispatchedAction({ type: 't', payload: 'nope' }, { x: 1 })).toEqual({
      type: 't',
      payload: { x: 1 },
    });
    expect(buildDispatchedAction({ type: 't', payload: [1, 2] })).toEqual({
      type: 't',
      payload: {},
    });
  });

  test('no payload and no formValues -> empty payload', () => {
    expect(buildDispatchedAction({ type: 't' })).toEqual({ type: 't', payload: {} });
  });
});

describe('resolveBindingString', () => {
  const data = {
    a: { b: 'hello', n: 42, flag: false, nil: null, obj: { deep: 'x' }, arr: [1] },
  };

  test('replaces {{a.b}} tokens', () => {
    expect(resolveBindingString('say {{a.b}}!', data)).toBe('say hello!');
    expect(resolveBindingString('{{ a.b }}', data)).toBe('hello');
  });

  test('missing path leaves the token untouched', () => {
    expect(resolveBindingString('{{a.missing}}', data)).toBe('{{a.missing}}');
    expect(resolveBindingString('{{nope.b}}', data)).toBe('{{nope.b}}');
  });

  test('number and boolean leaves stringify', () => {
    expect(resolveBindingString('n={{a.n}}', data)).toBe('n=42');
    expect(resolveBindingString('f={{a.flag}}', data)).toBe('f=false');
  });

  test('null, object, and array leaves keep the token', () => {
    expect(resolveBindingString('{{a.nil}}', data)).toBe('{{a.nil}}');
    expect(resolveBindingString('{{a.obj}}', data)).toBe('{{a.obj}}');
    expect(resolveBindingString('{{a.arr}}', data)).toBe('{{a.arr}}');
  });
});

describe('resolveBindings', () => {
  const data = { user: { name: 'Ada', id: 5 } };

  test('resolves strings nested in records and arrays', () => {
    const node = {
      title: 'hi {{user.name}}',
      items: ['{{user.name}}', 'static', { label: 'id {{user.id}}' }],
      count: 3,
      enabled: true,
      nothing: null,
    };
    expect(resolveBindings(node, data)).toEqual({
      title: 'hi Ada',
      items: ['Ada', 'static', { label: 'id 5' }],
      count: 3,
      enabled: true,
      nothing: null,
    });
  });

  test('non-string leaf types pass through unchanged', () => {
    expect(resolveBindings(42, data)).toBe(42);
    expect(resolveBindings(false, data)).toBe(false);
    expect(resolveBindings(null, data)).toBeNull();
  });
});
