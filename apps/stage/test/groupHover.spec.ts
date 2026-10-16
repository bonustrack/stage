import { describe, expect, test } from 'bun:test';
import { groupKeysOf, groupRows } from '../components/home/groups.model';
import type { Row } from '../components/home/model';

function row(convId: string, extra: Partial<Row> = {}): Row {
  return {
    convId, title: convId, lastTs: 1, lastBubbleTs: 1, lastPreview: '', avatarAddress: null, avatarUri: null,
    peerAddress: null, lastSenderAddress: null, lastFromSelf: false, inboxToAddr: {}, unreadCount: 0, lastReadNs: 0,
    markedUnread: false, selfInboxId: 'me', labels: [], category: null, assigned: [], consent: null, ...extra,
  };
}

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { labels: ['Done', 'Todo'] });
const loose = row('loose');
const nameOf = (address: string): string => address;

describe('group hover sections', () => {
  test('ungrouped rows have no section', () => {
    expect([...groupKeysOf([work, loose])]).toEqual([]);
  });

  test('every header and visible row belongs to its full section, including folded sections', () => {
    const items = groupRows([dm, work, loose], 'label', new Set(['label:done']), false, nameOf);
    expect([...groupKeysOf(items)]).toEqual([
      ['group:dm', 'dm'], ['dm', 'dm'],
      ['group:label:done', 'label:done'],
      ['group:label:todo', 'label:todo'], ['work', 'label:todo'],
      ['group:none', 'none'], ['loose', 'none'],
    ]);
  });

  test('a chat in multiple sections uses its own displayed list key for each section', () => {
    const items = groupRows([work], 'label', new Set(), false, nameOf);
    expect(groupKeysOf(items).get('work')).toBe('label:done');
    expect(groupKeysOf(items).get('label:todo/work')).toBe('label:todo');
  });
});
