import { describe, expect, test } from 'bun:test';
import { groupRows, type HomeListItem } from '../components/home/groups.model';
import {
  NO_ROW_MEASUREMENTS, blockShift, categoryZones, dragTarget, measuredRowHeights, recordRowMeasurement, rowBlocks,
  sectionBlocks, sectionShape,
} from '../components/home/listDrag.model';
import type { Row } from '../components/home/model';

const HEADER = 40;
const ROW = 67;

function row(convId: string, category: string | null = null): Row {
  return {
    convId, title: convId, lastTs: 1, lastBubbleTs: 1, lastPreview: '', avatarAddress: null, avatarUri: null,
    peerAddress: null, lastSenderAddress: null, lastFromSelf: false, inboxToAddr: {}, unreadCount: 0, lastReadNs: 0,
    markedUnread: false, selfInboxId: 'me', labels: [], category, assigned: [], consent: null,
  };
}

const a = row('a', 'Alpha');
const b = row('b', 'Beta');
const c = row('c', 'Beta');
const loose = row('loose');
const heights = new Map([['a', 121], ['b', 157], ['c', 83]]);
const items = groupRows([a, b, c, loose], 'category', new Set(), false, address => address);

function target(blocks: ReturnType<typeof rowBlocks>, from: number, offset: number): number {
  return dragTarget(blocks.tops, blocks.heights, blocks.zones, from, offset);
}

describe('measured list drag geometry', () => {
  test('pinned rows cross actual midpoints and shift by the full moved row height', () => {
    const blocks = rowBlocks(['a', 'b', 'c'], ROW, heights);
    expect(blocks.tops).toEqual([0, 121, 278]);
    expect(blocks.heights).toEqual([121, 157, 83]);
    expect(target(blocks, 0, 70)).toBe(0);
    expect(target(blocks, 0, 80)).toBe(1);
    expect(target(blocks, 2, -70)).toBe(2);
    expect(target(blocks, 2, -80)).toBe(1);
    expect(blockShift(1, 0, 1, blocks.heights[0] ?? 0)).toBe(-121);
    expect(blockShift(1, 2, 1, blocks.heights[2] ?? 0)).toBe(83);
  });

  test('section blocks add the measured heights of visible rows only', () => {
    const blocks = sectionBlocks(items, HEADER, ROW, heights);
    expect(blocks.ids).toEqual(['category:alpha', 'category:beta']);
    expect(blocks.heights).toEqual([161, 280]);
    expect(blocks.tops).toEqual([0, 161]);
    expect(target(blocks, 0, 100)).toBe(0);
    expect(target(blocks, 0, 141)).toBe(1);
    const folded = groupRows([a, b, c, loose], 'category', new Set(['category:beta']), false, address => address);
    const collapsed = sectionBlocks(folded, HEADER, ROW, heights);
    expect(collapsed.heights).toEqual([161, HEADER]);
    expect(target(collapsed, 0, 21)).toBe(1);
  });

  test('category drop zones follow measured row centers, including no category', () => {
    const { blocks, categories } = categoryZones(items, HEADER, ROW, heights);
    expect(blocks.tops).toEqual([0, 40, 161, 201, 358, 441, 481]);
    expect(blocks.heights).toEqual([HEADER, 121, HEADER, 157, 83, HEADER, ROW]);
    expect(target(blocks, 1, 40)).toBe(1);
    expect(target(blocks, 1, 61)).toBe(2);
    expect(target(blocks, 3, -100)).toBe(3);
    expect(target(blocks, 3, -119)).toBe(0);
    expect(target(blocks, 4, 41)).toBe(4);
    expect(target(blocks, 4, 42)).toBe(5);
    expect(categories.get(blocks.ids[5] ?? '')).toBeNull();
  });

  test('unmeasured rows use the existing fallback without overriding measured neighbours', () => {
    const measured = new Map([['b', 157]]);
    expect(rowBlocks(['a', 'b', 'c'], ROW, measured).heights).toEqual([ROW, 157, ROW]);
    expect(sectionBlocks(items, HEADER, ROW, measured).heights).toEqual([HEADER + ROW, HEADER + 157 + ROW]);
    expect(categoryZones(items, HEADER, ROW, measured).blocks.heights).toEqual([HEADER, ROW, HEADER, 157, ROW, HEADER, ROW]);
  });

  test('height updates rebuild geometry even when the section shape is unchanged', () => {
    const before = sectionShape(items);
    const taller = new Map(heights).set('a', 190);
    expect(sectionShape(items)).toBe(before);
    expect(categoryZones(items, HEADER, ROW, taller).blocks.tops[2]).toBe(230);
    expect(sectionBlocks(items, HEADER, ROW, taller).heights[0]).toBe(230);
    expect(target(categoryZones(items, HEADER, ROW, taller).blocks, 1, 80)).toBe(1);
    expect(target(categoryZones(items, HEADER, ROW, heights).blocks, 1, 80)).toBe(2);
    expect(a.category).toBe('Alpha');
    expect(a.assigned).toEqual([]);
    expect(a.labels).toEqual([]);
  });
});

describe('list row measurement validity', () => {
  test('keeps actual fractional sizes and ignores duplicate measurements', () => {
    const measured = recordRowMeasurement(NO_ROW_MEASUREMENTS, a, 320.5, 121.75);
    expect(measuredRowHeights([a], measured).get('a')).toBe(121.75);
    expect(recordRowMeasurement(measured, a, 320.5, 121.75)).toBe(measured);
    const updated = recordRowMeasurement(measured, a, 320.5, 144.25);
    expect(measuredRowHeights([a], updated).get('a')).toBe(144.25);
    expect(measuredRowHeights([a], measured).get('a')).toBe(121.75);
  });

  test('hidden or invalid layout events never replace a usable measurement', () => {
    const measured = recordRowMeasurement(NO_ROW_MEASUREMENTS, a, 320, 121);
    for (const [width, height] of [[0, 0], [0, 121], [320, 0], [-1, 121], [320, -1], [NaN, 121], [320, Infinity]]) {
      expect(recordRowMeasurement(measured, a, width ?? 0, height ?? 0)).toBe(measured);
    }
  });

  test('a width change discards cached offscreen sizes until those rows are measured again', () => {
    let measured = recordRowMeasurement(NO_ROW_MEASUREMENTS, a, 320, 121);
    measured = recordRowMeasurement(measured, b, 320, 157);
    const narrower = recordRowMeasurement(measured, a, 240, 185);
    expect([...measuredRowHeights([a, b], narrower)]).toEqual([['a', 185]]);
    expect(rowBlocks(['a', 'b'], ROW, measuredRowHeights([a, b], narrower)).heights).toEqual([185, ROW]);
    const remeasured = recordRowMeasurement(narrower, b, 240, 205);
    expect([...measuredRowHeights([a, b], remeasured)]).toEqual([['a', 185], ['b', 205]]);
  });

  test('data changes invalidate only that row and removal excludes its cached size', () => {
    let measured = recordRowMeasurement(NO_ROW_MEASUREMENTS, a, 320, 121);
    measured = recordRowMeasurement(measured, b, 320, 157);
    const changed = { ...a, category: 'A much longer category', assigned: ['0xperson'] };
    expect([...measuredRowHeights([changed, b], measured)]).toEqual([['b', 157]]);
    expect([...measuredRowHeights([b], measured)]).toEqual([['b', 157]]);
    const refreshed = recordRowMeasurement(measured, changed, 320, 177);
    expect([...measuredRowHeights([changed, b], refreshed)]).toEqual([['a', 177], ['b', 157]]);
  });

  test('measurements follow stable rendered keys through reorder and repeated channels', () => {
    const repeat: HomeListItem = { ...a, listKey: 'label:other/a' };
    let measured = recordRowMeasurement(NO_ROW_MEASUREMENTS, a, 320, 121);
    measured = recordRowMeasurement(measured, repeat, 320, 140);
    measured = recordRowMeasurement(measured, b, 320, 157);
    const selected = measuredRowHeights([b, repeat, a], measured);
    expect([...selected]).toEqual([['b', 157], ['label:other/a', 140], ['a', 121]]);
    expect(rowBlocks(['b', 'a'], ROW, selected).tops).toEqual([0, 157]);
  });
});
