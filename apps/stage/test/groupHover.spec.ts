import { describe, expect, test } from 'bun:test';
import { groupKeysOf, groupRows, isGroupHeader, listKeyOf, type HomeListItem } from '../components/home/groups.model';
import { row } from './rowFixture';

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { labels: ['Done', 'Todo'] });
const loose = row('loose');
const nameOf = (address: string): string => address;

function sectionOfEach(items: readonly HomeListItem[]): [string, string | undefined][] {
  const sections = groupKeysOf(items);
  return items.map((item) => [isGroupHeader(item) ? `# ${item.header.key}` : item.convId, sections.get(listKeyOf(item))]);
}

describe('group hover sections', () => {
  test('ungrouped rows have no section', () => {
    expect([...groupKeysOf([work, loose])]).toEqual([]);
  });

  test('every header and visible row belongs to its full section, including folded sections', () => {
    const items = groupRows([dm, work, loose], 'label', new Set(['label:done']), false, nameOf);
    expect(sectionOfEach(items)).toEqual([
      ['# dm', 'dm'],
      ['dm', 'dm'],
      ['# label:done', 'label:done'],
      ['# label:todo', 'label:todo'],
      ['work', 'label:todo'],
      ['# none', 'none'],
      ['loose', 'none'],
    ]);
  });

  test('a chat in multiple sections belongs to each section it shows in', () => {
    const items = groupRows([work], 'label', new Set(), false, nameOf);
    expect(sectionOfEach(items)).toEqual([
      ['# label:done', 'label:done'],
      ['work', 'label:done'],
      ['# label:todo', 'label:todo'],
      ['work', 'label:todo'],
    ]);
  });
});
