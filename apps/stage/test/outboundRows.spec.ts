import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import {
  matchConfirmed, mergeConfirmed, outboundView, recordSent, settleOutbound,
  type OutboundState, type OutboundView,
} from '../components/conversation/outboundRows.model';

const ME = 'metro://xmtp/me';
const T0 = Date.parse('2026-09-25T10:00:00.000Z');

const entry = (id: string, ms: number, text: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, ts: new Date(T0 + ms).toISOString(), station: 'xmtp', line: 'l', from: ME, to: 'l', text, ...extra,
});

const pendingState = (...optimistic: HistoryEntry[]): OutboundState => ({ optimistic, confirmedIds: new Map() });
const keyOf = (view: OutboundView, id: string) => view.localIdOf.get(id) ?? id;

function settle(state: OutboundState, live: HistoryEntry[]) {
  const before = outboundView(state, live, ME);
  const next = settleOutbound(state, before.confirmed);
  return { before, next, after: outboundView(next, live, ME) };
}

describe('a sent message keeps its row once the server confirms it', () => {
  test('a text-matched confirmation keeps the pending row key after cleanup', () => {
    const { before, next, after } = settle(pendingState(entry('tmp_1', 0, 'hello')), [entry('real_1', 400, 'hello')]);
    expect(before.pending).toEqual([]);
    expect(next.optimistic).toEqual([]);
    expect(keyOf(before, 'real_1')).toBe('tmp_1');
    expect(keyOf(after, 'real_1')).toBe('tmp_1');
  });

  test('an id-matched confirmation keeps the pending row key after cleanup', () => {
    const sent = recordSent(pendingState(entry('tmp_1', 0, '@alice hi')), 'tmp_1', 'real_1');
    const { before, next, after } = settle(sent, [entry('real_1', 400, 'alice hi')]);
    expect(next.optimistic).toEqual([]);
    expect(keyOf(before, 'real_1')).toBe('tmp_1');
    expect(keyOf(after, 'real_1')).toBe('tmp_1');
  });

  test('sending the same text again leaves the settled row alone and waits for its own message', () => {
    const first = [entry('real_1', 400, 'ok')];
    const settled = settle(pendingState(entry('tmp_1', 0, 'ok')), first).next;
    const again = { ...settled, optimistic: [entry('tmp_2', 700, 'ok')] };
    const waiting = outboundView(again, first, ME);
    expect(waiting.pending.map(o => o.id)).toEqual(['tmp_2']);
    expect(keyOf(waiting, 'real_1')).toBe('tmp_1');
    const { before, after } = settle(again, [...first, entry('real_2', 1_100, 'ok')]);
    expect([keyOf(before, 'real_1'), keyOf(before, 'real_2')]).toEqual(['tmp_1', 'tmp_2']);
    expect([keyOf(after, 'real_1'), keyOf(after, 'real_2')]).toEqual(['tmp_1', 'tmp_2']);
    expect(after.pending).toEqual([]);
  });

  test('a failed send drops its pending row', () => {
    const state = pendingState(entry('tmp_2', 100, 'b'), entry('tmp_1', 0, 'a'));
    expect(recordSent(state, 'tmp_1').optimistic.map(o => o.id)).toEqual(['tmp_2']);
  });
});

describe('matching pending messages to the live feed', () => {
  test('two identical texts pair with distinct live messages in send order', () => {
    const optimistic = [entry('tmp_2', 100, 'ok'), entry('tmp_1', 0, 'ok')];
    const live = [entry('real_1', 300, 'ok'), entry('real_2', 400, 'ok')];
    const confirmed = matchConfirmed(optimistic, live, ME, new Map());
    expect(confirmed.get('tmp_1')).toBe('real_1');
    expect(confirmed.get('tmp_2')).toBe('real_2');
  });

  test('only my own messages close to the send time count as a text match', () => {
    const sent = [entry('tmp_1', 0, 'hello')];
    expect(matchConfirmed(sent, [entry('x', 400, 'hello', { from: 'metro://xmtp/other' })], ME, new Map()).size).toBe(0);
    expect(matchConfirmed(sent, [entry('x', -5_000, 'hello')], ME, new Map()).size).toBe(0);
    expect(matchConfirmed(sent, [entry('x', 40_000, 'hello')], ME, new Map()).size).toBe(0);
    expect(matchConfirmed(sent, [entry('x', 400, 'hello!')], ME, new Map()).size).toBe(0);
  });

  test('an attachment is only confirmed by its sent id', () => {
    const photo = entry('tmp_1', 0, '', { payload: { attachments: [{ mime: 'image/png' }] } });
    const live = [entry('real_1', 400, '')];
    expect(matchConfirmed([photo], live, ME, new Map()).size).toBe(0);
    expect(matchConfirmed([photo], live, ME, new Map([['tmp_1', 'real_1']])).get('tmp_1')).toBe('real_1');
  });
});

describe('recording confirmations', () => {
  test('an unchanged confirmation keeps the same map', () => {
    const prev = new Map([['tmp_1', 'real_1']]);
    expect(mergeConfirmed(prev, new Map([['tmp_1', 'real_1']]))).toBe(prev);
    expect(mergeConfirmed(prev, new Map())).toBe(prev);
  });

  test('a new confirmation is added without dropping earlier ones', () => {
    const prev = new Map([['tmp_1', 'real_1']]);
    const next = mergeConfirmed(prev, new Map([['tmp_2', 'real_2']]));
    expect(next).not.toBe(prev);
    expect([...next]).toEqual([['tmp_1', 'real_1'], ['tmp_2', 'real_2']]);
    expect(prev.size).toBe(1);
  });
});
