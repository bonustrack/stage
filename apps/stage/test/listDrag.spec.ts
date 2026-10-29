import { describe, expect, test } from 'bun:test';
import { groupRows } from '../components/home/groups.model';
import { NO_HOME_DRAG, homeDragModel, pinMove, sectionMove, zoneAt, zoneMove } from '../components/home/listDrag.model';
import type { Row } from '../components/home/model';

function row(convId: string, extra: Partial<Row> = {}): Row {
  return {
    convId,
    title: convId,
    lastTs: 1,
    lastBubbleTs: 1,
    lastPreview: '',
    avatarAddress: null,
    avatarUri: null,
    peerAddress: null,
    lastSenderAddress: null,
    lastFromSelf: false,
    inboxToAddr: {},
    unreadCount: 0,
    lastReadNs: 0,
    markedUnread: false,
    selfInboxId: 'me',
    labels: [],
    category: null,
    assigned: [],
    consent: null,
    ...extra,
  };
}

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { category: 'Work', labels: ['Todo'] });
const work2 = row('work2', { category: 'work', labels: ['Done'] });
const alpha = row('alpha', { category: 'Alpha', labels: ['Done'] });
const loose = row('loose');
const nameOf = (address: string): string => address;
const byProject = (rows: Row[], folded: string[] = []) => homeDragModel(groupRows(rows, 'category', new Set(folded), false, nameOf), true);
const move = (itemId: string, fromIndex: number, toIndex: number, beforeId: string | null, afterId: string | null) => ({
  itemId,
  fromListId: 'l',
  toListId: 'l',
  fromIndex,
  toIndex,
  beforeId,
  afterId,
});

describe('dragging project sections', () => {
  test('every project section is a block, direct messages and no project included, and rows follow their header', () => {
    const model = byProject([dm, work, work2, alpha, loose], ['category:work']);
    expect(model.sections).toEqual(['group:dm', 'group:category:alpha', 'group:category:work', 'group:none']);
    expect([...model.sectionKeys.values()]).toEqual(['dm', 'category:alpha', 'category:work', 'none']);
    expect(model.sectionOf.get('alpha')).toBe('group:category:alpha');
    expect(model.sectionOf.get('dm')).toBe('group:dm');
    expect(model.sectionOf.get('loose')).toBe('group:none');
    expect(model.sectionOf.has('work')).toBe(false);
  });

  test('other groupings and the flat list have nothing to drag', () => {
    expect(homeDragModel(groupRows([work, alpha], 'label', new Set(), false, nameOf), true).sections).toEqual([]);
    expect(homeDragModel(groupRows([work, alpha], 'category', new Set(), false, nameOf), false)).toBe(NO_HOME_DRAG);
  });

  test('a section takes the place of the section it passes', () => {
    const model = byProject([dm, work, alpha, loose]);
    expect(sectionMove(model, move('group:category:work', 2, 0, null, 'group:dm'))).toEqual({
      key: 'category:work',
      target: 'dm',
      visible: ['dm', 'category:alpha', 'category:work', 'none'],
    });
    expect(sectionMove(model, move('group:dm', 0, 3, 'group:none', null))?.target).toBe('none');
    expect(sectionMove(model, move('alpha', 1, 2, 'group:category:work', null))).toBeNull();
  });

  test('a pinned chat takes the place of the pinned chat it passes', () => {
    expect(pinMove(['a', 'b', 'c'], move('a', 0, 1, 'b', 'c'))).toBe(1);
    expect(pinMove(['a', 'b', 'c'], move('c', 2, 0, null, 'a'))).toBe(0);
    expect(pinMove(['a', 'b'], move('a', 0, 1, 'gone', null))).toBeNull();
  });
});

describe('moving a chat to another project', () => {
  const model = byProject([dm, work, work2, alpha, loose]);

  test('every header and row has a place, tagged with the section it drops into, direct messages excluded', () => {
    expect(model.rows).toEqual([
      'group:dm',
      'dm',
      'group:category:alpha',
      'alpha',
      'group:category:work',
      'work',
      'work2',
      'group:none',
      'loose',
    ]);
    expect([...model.zoneOf]).toEqual([
      ['group:category:alpha', 'group:category:alpha'],
      ['alpha', 'group:category:alpha'],
      ['group:category:work', 'group:category:work'],
      ['work', 'group:category:work'],
      ['work2', 'group:category:work'],
      ['group:none', 'group:none'],
      ['loose', 'group:none'],
    ]);
    expect([...model.categories]).toEqual([
      ['group:category:alpha', 'Alpha'],
      ['group:category:work', 'Work'],
      ['group:none', null],
    ]);
  });

  test('the target is the section of the place above the drop point', () => {
    expect(zoneAt(model, 'work2', 4)).toBe('group:category:alpha');
    expect(zoneAt(model, 'work2', 7)).toBe('group:none');
    expect(zoneAt(model, 'loose', 4)).toBe('group:category:alpha');
    expect(zoneMove(model, move('work2', 6, 4, 'alpha', 'group:category:work'))).toEqual({ convId: 'work2', category: 'Alpha' });
    expect(zoneMove(model, move('work2', 6, 7, 'group:none', 'loose'))).toEqual({ convId: 'work2', category: null });
  });

  test('its own section and the direct messages are no target', () => {
    expect(zoneAt(model, 'work2', 6)).toBeUndefined();
    expect(zoneAt(model, 'work2', 0)).toBeUndefined();
    expect(zoneAt(model, 'work2', 2)).toBeUndefined();
    expect(zoneMove(model, move('work2', 6, 5, 'group:category:work', 'work'))).toBeNull();
  });

  test('a folded section takes a drop on its header', () => {
    const folded = byProject([work, alpha], ['category:work']);
    expect(folded.rows).toEqual(['group:category:alpha', 'alpha', 'group:category:work']);
    expect(zoneAt(folded, 'alpha', 2)).toBe('group:category:work');
  });
});
