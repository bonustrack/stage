import { describe, expect, test } from 'bun:test';
import { feedOrientation as inverted } from '../components/conversation/feedOrientation';
import { feedOrientation as upright } from '../components/conversation/feedOrientation.web';
import { FEED_MIN_BATCH, type FeedScrollState } from '../components/conversation/feedOrientation.core';
import type { VirtualListHandle } from '../components/layout/VirtualList.types';

const CONTENT = 3000;
const VIEWPORT = 800;
const maxOffset = CONTENT - VIEWPORT;
const metrics = (offset: number) => ({ offset, contentHeight: CONTENT, viewportHeight: VIEWPORT });

function fakeList(scrolled: number[]): VirtualListHandle {
  return {
    scrollToOffset: ({ offset }) => {
      scrolled.push(offset);
    },
    scrollToEnd: () => undefined,
    scrollToIndex: () => undefined,
    visibleAnchor: () => null,
    scrollToAnchor: () => false,
  };
}

function state(over: Partial<FeedScrollState> = {}, scrolled: number[] = []): FeedScrollState {
  return {
    list: { current: fakeList(scrolled) },
    savedDistance: 0,
    savedAnchor: null,
    savedLoaded: true,
    restored: false,
    pinUntil: 0,
    atNewest: true,
    viewportHeight: VIEWPORT,
    userDragged: false,
    metrics: metrics(0),
    positioned: false,
    settleUntil: 0,
    olderPending: false,
    ...over,
  };
}

describe('both feed orientations report the same distance from the newest message', () => {
  test('an inverted list measures distance as the raw offset', () => {
    expect(inverted.distanceFromNewest(metrics(0))).toBe(0);
    expect(inverted.distanceFromNewest(metrics(640))).toBe(640);
  });

  test('an upright list measures distance back from the end', () => {
    expect(upright.distanceFromNewest(metrics(maxOffset))).toBe(0);
    expect(upright.distanceFromNewest(metrics(maxOffset - 640))).toBe(640);
    expect(upright.distanceFromNewest(metrics(0))).toBe(maxOffset);
  });

  test('rubber-band overscroll never reports a negative distance', () => {
    expect(inverted.distanceFromNewest(metrics(-40))).toBe(0);
    expect(upright.distanceFromNewest(metrics(maxOffset + 40))).toBe(0);
  });
});

describe('a saved distance restores to the same place in an upright list', () => {
  test('zero distance lands on the newest message', () => {
    const scrolled: number[] = [];
    expect(upright.restore(state({}, scrolled), CONTENT, 0)).toBe(maxOffset);
    expect(scrolled).toEqual([maxOffset]);
  });

  test('a saved distance round-trips through both directions', () => {
    for (const distance of [0, 120, 640, maxOffset]) {
      const offset = upright.restore(state({ savedDistance: distance, atNewest: false }), CONTENT, 0);
      expect(offset).not.toBeNull();
      expect(upright.distanceFromNewest(metrics(offset ?? -1))).toBe(distance);
    }
  });

  test('a distance longer than the history clamps to the top instead of going negative', () => {
    expect(upright.restore(state({ savedDistance: 99_999, atNewest: false }), CONTENT, 0)).toBe(0);
  });

  test('an unmeasured viewport still scrolls toward the newest end', () => {
    expect(upright.restore(state({ viewportHeight: 0 }), CONTENT, 0)).toBe(CONTENT);
  });

  test('a saved anchor that is found replaces the offset scroll', () => {
    const scrolled: number[] = [];
    const s = state({ savedDistance: 640, savedAnchor: { key: 'm1', offset: 12 }, atNewest: false }, scrolled);
    s.list.current = { ...fakeList(scrolled), scrollToAnchor: () => true };
    expect(upright.restore(s, CONTENT, 0)).toBe(maxOffset - 640);
    expect(scrolled).toEqual([]);
  });
});

describe('an upright feed lands on the newest message and stays put once the reader takes over', () => {
  test('opening a conversation pins to the newest message as content renders in', () => {
    expect(upright.restore(state(), CONTENT, 0)).toBe(maxOffset);
  });

  test('it keeps pinning even when growth has pushed the measured position off the end', () => {
    expect(upright.restore(state({ atNewest: false }), CONTENT, 0)).toBe(maxOffset);
  });

  test('a dragged-away reader is left alone', () => {
    expect(upright.restore(state({ atNewest: false, userDragged: true }), CONTENT, 0)).toBeNull();
  });

  test('scrolling back to the newest message makes it sticky again', () => {
    expect(upright.restore(state({ userDragged: true, atNewest: true }), CONTENT, 0)).toBe(maxOffset);
  });

  test('a saved position wins once, then stops fighting the reader', () => {
    const s = state({ savedDistance: 500, atNewest: false });
    expect(upright.restore(s, CONTENT, 0)).toBe(maxOffset - 500);
    expect(s.restored).toBe(true);
    expect(s.settleUntil).toBeGreaterThan(0);
    expect(upright.restore(s, CONTENT, 0)).toBeNull();
  });

  test('nothing moves until the saved position has been read back', () => {
    expect(upright.restore(state({ savedLoaded: false }), CONTENT, 0)).toBeNull();
  });

  test('scroll events are ignored until the feed is positioned and the restore has settled', () => {
    const now = 1_000;
    expect(upright.settling(state({ positioned: false }), now)).toBe(true);
    expect(upright.settling(state({ positioned: true, settleUntil: now + 1 }), now)).toBe(true);
    expect(upright.settling(state({ positioned: true, settleUntil: now }), now)).toBe(false);
    expect(inverted.settling(state({ positioned: false }), now)).toBe(false);
  });
});

describe('an upright feed paints its loaded rows in one pass', () => {
  test('a page-sized conversation renders every row in the first batch', () => {
    expect(upright.firstBatch(20)).toBe(20);
  });

  test('a nearly empty conversation still asks for the minimum batch', () => {
    expect(upright.firstBatch(0)).toBe(FEED_MIN_BATCH);
    expect(upright.firstBatch(4)).toBe(FEED_MIN_BATCH);
    expect(inverted.firstBatch(500)).toBe(FEED_MIN_BATCH);
  });

  test('a long history is capped so the first paint stays affordable', () => {
    expect(upright.firstBatch(500)).toBe(60);
  });
});

describe('older pages load when the reader asks, not while the feed is settling', () => {
  const at = (offset: number, contentHeight: number) => ({ offset, contentHeight, viewportHeight: 800 });

  test('nothing pages until the feed has taken its opening position', () => {
    expect(upright.defersOlderPage(at(0, 3000), false)).toBe(true);
  });

  test('a feed resting on the newest message does not page', () => {
    expect(upright.defersOlderPage(at(2200, 3000), true)).toBe(true);
  });

  test('a reader near the oldest loaded row pages', () => {
    expect(upright.defersOlderPage(at(0, 3000), true)).toBe(false);
    expect(upright.defersOlderPage(at(400, 3000), true)).toBe(false);
  });

  test('a feed with nothing to scroll fills itself', () => {
    expect(upright.defersOlderPage(at(0, 500), true)).toBe(false);
  });

  test('an inverted feed pages as soon as its end is reached', () => {
    expect(inverted.defersOlderPage(at(0, 3000), false)).toBe(false);
  });
});

describe('both orientations keep the newest message at the bottom of the screen', () => {
  test('an upright list shows the oldest row first and maps a newest-first index to its row', () => {
    expect(upright.rows(['c', 'b', 'a'])).toEqual(['a', 'b', 'c']);
    expect(upright.rowIndexOf(0, 3)).toBe(2);
    expect(upright.listAnchor).toBe('end');
  });

  test('an inverted list keeps the newest-first order and index', () => {
    const newestFirst = ['c', 'b', 'a'];
    expect(inverted.rows(newestFirst)).toBe(newestFirst);
    expect(inverted.rowIndexOf(0, 3)).toBe(0);
    expect(inverted.listAnchor).toBe('start');
  });
});
