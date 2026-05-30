/**
 * Unit tests for `src/define-train.ts` — the train-authoring SDK (#13).
 *
 * Exercises buildTrain's call-dispatch (op:call → op:response), the
 * inbound/outbound envelope helpers, account boot, and error→response mapping,
 * all with an injected `write` sink so no real stdin/stdout is touched.
 */

import { describe, expect, test } from 'bun:test';
import { buildTrain, type CallMsg } from '../src/define-train.ts';

function harness(opts: Parameters<typeof buildTrain>[0]) {
  const lines: Record<string, unknown>[] = [];
  const t = buildTrain(opts, s => { for (const l of s.trim().split('\n')) if (l) lines.push(JSON.parse(l)); });
  return { ...t, lines };
}

describe('buildTrain dispatch', () => {
  test('routes a call to its action and emits op:response with the result', async () => {
    const h = harness({
      name: 'demo',
      actions: { ping: (args) => ({ pong: (args as { n: number }).n + 1 }) },
    });
    await h.dispatch({ op: 'call', id: 'r1', action: 'ping', args: { n: 41 } } satisfies CallMsg);
    expect(h.lines).toEqual([{ op: 'response', id: 'r1', result: { pong: 42 } }]);
  });

  test('a thrown action becomes an error response', async () => {
    const h = harness({ name: 'demo', actions: { boom: () => { throw new Error('nope'); } } });
    await h.dispatch({ op: 'call', id: 'r2', action: 'boom', args: {} });
    expect(h.lines[0]).toEqual({ op: 'response', id: 'r2', error: 'nope' });
  });

  test('unknown action lists the known actions', async () => {
    const h = harness({ name: 'demo', actions: { a: () => 1, b: () => 2 } });
    await h.dispatch({ op: 'call', id: 'r3', action: 'zzz', args: {} });
    expect((h.lines[0] as { error: string }).error).toContain("unknown action 'zzz'");
    expect((h.lines[0] as { error: string }).error).toContain('a, b');
  });

  test('null result is normalised (never undefined on the wire)', async () => {
    const h = harness({ name: 'demo', actions: { noop: () => undefined } });
    await h.dispatch({ op: 'call', id: 'r4', action: 'noop', args: {} });
    expect(h.lines[0]).toEqual({ op: 'response', id: 'r4', result: null });
  });
});

describe('envelope helpers', () => {
  test('emitInbound stamps kind/from/station/id/ts', () => {
    const h = harness({ name: 'demo', actions: {} });
    const id = h.ctx.emitInbound({ line: 'metro://demo/room', text: 'hi' });
    const ev = h.lines[0];
    expect(ev.kind).toBe('inbound');
    expect(ev.line).toBe('metro://demo/room');
    expect(ev.station).toBe('demo');
    expect(ev.id).toBe(id);
    expect(typeof ev.ts).toBe('string');
    expect(id.startsWith('msg_')).toBe(true);
  });

  test('emitOutbound sets to=line and kind=outbound', () => {
    const h = harness({ name: 'demo', actions: {} });
    h.ctx.emitOutbound({ line: 'metro://demo/room', message_id: 'X', text: 'yo' });
    expect(h.lines[0]).toMatchObject({ kind: 'outbound', to: 'metro://demo/room', message_id: 'X', text: 'yo' });
  });

  test('a caller-supplied id is preserved', () => {
    const h = harness({ name: 'demo', actions: {} });
    const id = h.ctx.emit({ line: 'metro://demo/x', id: 'msg_fixed' });
    expect(id).toBe('msg_fixed');
    expect(h.lines[0].id).toBe('msg_fixed');
  });
});

describe('account boot', () => {
  test('boot populates ctx.accounts and actions can read them', async () => {
    const h = harness({
      name: 'multi',
      accounts: () => [{ id: 'tony', client: 1 }, { id: 'codex', client: 2 }],
      actions: { who: (_a, ctx) => [...ctx.accounts.keys()] },
    });
    await h.boot();
    expect([...h.ctx.accounts.keys()]).toEqual(['tony', 'codex']);
    await h.dispatch({ op: 'call', id: 'r5', action: 'who', args: {} });
    expect((h.lines[0] as { result: string[] }).result).toEqual(['tony', 'codex']);
  });
});
