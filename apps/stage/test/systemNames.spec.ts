import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { memberNamer, withMemberNames } from '../components/conversation/systemNames.model';

const entry = (payload: unknown, text = 'added 1 member'): HistoryEntry => ({
  id: 'm1', ts: '2026-09-25T00:00:00Z', station: 'xmtp', line: 'l', from: 'u', to: 'l', text, payload,
} as HistoryEntry);

describe('member names in group event lines', () => {
  const nameOf = memberNamer('me', id => (id === 'peer' ? '0xabc' : null), () => '@tony123');

  test('names added members, calling yourself "you"', () => {
    const e = entry({ system: true, groupUpdate: { addedInboxes: [{ inboxId: 'me' }] } });
    expect(withMemberNames(e, nameOf).text).toBe('added you');
    const p = entry({ system: true, groupUpdate: { addedInboxes: [{ inboxId: 'peer' }] } });
    expect(withMemberNames(p, nameOf).text).toBe('added @tony123');
  });

  test('keeps other entries untouched', () => {
    const e = entry({ contentType: 'text' }, 'hello');
    expect(withMemberNames(e, nameOf)).toBe(e);
  });
});
