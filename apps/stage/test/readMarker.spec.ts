import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { countFromOthers } from '../components/conversation/feed-helpers';

const msg = (id: string, from: string): HistoryEntry => ({
  id, ts: new Date(1000).toISOString(), station: 'xmtp', line: 'l', from, to: 'l',
});

describe('read marker', () => {
  test('counts only messages from someone else', () => {
    expect(countFromOthers([msg('a', 'peer'), msg('b', 'me'), msg('c', 'other')], 'me')).toBe(2);
  });

  test('does not move when you send', () => {
    const before = [msg('a', 'peer')];
    expect(countFromOthers([...before, msg('mine', 'me')], 'me')).toBe(countFromOthers(before, 'me'));
  });
});
