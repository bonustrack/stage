import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { localIdsByLiveId, matchConfirmed, mergeConfirmed } from '../components/conversation/outboundRows.model';

const ME = 'metro://xmtp/me';
const T0 = Date.parse('2026-09-25T10:00:00.000Z');

const entry = (id: string, ms: number, text: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, ts: new Date(T0 + ms).toISOString(), station: 'xmtp', line: 'l', from: ME, to: 'l', text, ...extra,
});

function settle(optimistic: HistoryEntry[], live: HistoryEntry[], confirmedIds: Map<string, string>) {
  const confirmed = matchConfirmed(optimistic, live, ME, confirmedIds);
  const pending = optimistic.filter(o => !confirmed.has(o.id));
  const nextIds = mergeConfirmed(confirmedIds, confirmed);
  const afterCleanup = matchConfirmed(pending, live, ME, nextIds);
  return {
    keyBefore: (id: string) => localIdsByLiveId(confirmedIds, confirmed).get(id) ?? id,
    keyAfter: (id: string) => localIdsByLiveId(nextIds, afterCleanup).get(id) ?? id,
    pending,
  };
}

describe('a sent message keeps its row once the server confirms it', () => {
  test('a text-matched confirmation keeps the pending row key after cleanup', () => {
    const sent = entry('tmp_1', 0, 'hello');
    const { keyBefore, keyAfter, pending } = settle([sent], [entry('real_1', 400, 'hello')], new Map());
    expect(pending).toEqual([]);
    expect(keyBefore('real_1')).toBe('tmp_1');
    expect(keyAfter('real_1')).toBe('tmp_1');
  });

  test('an id-matched confirmation keeps the pending row key after cleanup', () => {
    const sent = entry('tmp_1', 0, '@alice hi');
    const live = [entry('real_1', 400, 'alice hi')];
    const { keyBefore, keyAfter, pending } = settle([sent], live, new Map([['tmp_1', 'real_1']]));
    expect(pending).toEqual([]);
    expect(keyBefore('real_1')).toBe('tmp_1');
    expect(keyAfter('real_1')).toBe('tmp_1');
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
