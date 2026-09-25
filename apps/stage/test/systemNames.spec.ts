import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { parseMentions } from '@stage-labs/client/xmtp/mentions';
import { memberNamer, withMemberNames } from '../components/conversation/systemNames.model';

const PEER = '0x59445094F08D01213bd6ba7215a6ab7a4bc29a4a';
const OTHER = '0x6f53196a053da13a1cced1115d104ae5e4c4bc06';

const entry = (payload: unknown, text = 'added 1 member'): HistoryEntry => ({
  id: 'm1', ts: '2026-09-25T00:00:00Z', station: 'xmtp', line: 'l', from: 'u', to: 'l', text, payload,
} as HistoryEntry);

describe('member names in group event lines', () => {
  const addresses: Record<string, string> = { peer: PEER, other: OTHER };
  const nameOf = memberNamer('me', id => addresses[id] ?? null);

  test('names added members as mentions, calling yourself "you"', () => {
    const e = entry({ system: true, groupUpdate: { addedInboxes: [{ inboxId: 'me' }] } });
    expect(withMemberNames(e, nameOf).text).toBe('added you');
    const p = entry({ system: true, groupUpdate: { addedInboxes: [{ inboxId: 'peer' }, { inboxId: 'other' }] } });
    const text = withMemberNames(p, nameOf).text;
    expect(text).toBe(`added @${PEER.toLowerCase()} and @${OTHER}`);
    expect(parseMentions(text)).toEqual([
      { type: 'text', text: 'added ' },
      { type: 'mention', address: PEER.toLowerCase() },
      { type: 'text', text: ' and ' },
      { type: 'mention', address: OTHER },
    ]);
  });

  test('falls back to a count when a member has no address', () => {
    const e = entry({ system: true, groupUpdate: { addedInboxes: [{ inboxId: 'peer' }, { inboxId: 'ghost' }] } });
    expect(withMemberNames(e, nameOf).text).toBe('added 2 members');
  });

  test('keeps other entries untouched', () => {
    const e = entry({ contentType: 'text' }, 'hello');
    expect(withMemberNames(e, nameOf)).toBe(e);
  });
});
