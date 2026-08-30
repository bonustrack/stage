import { describe, expect, test } from 'bun:test';
import {
  FEED_MAX_FIRST_PAINT, FEED_MIN_BATCH, feedDistanceFromNewest, initialUprightIndex,
  planUprightRestore, shouldPageOlder, uprightFirstBatch, uprightScrollOffset,
} from '../components/xmtp-conv/feed-helpers';

const CONTENT = 3000;
const VIEWPORT = 800;
const maxOffset = CONTENT - VIEWPORT;
const metrics = (offset: number) => ({ offset, contentHeight: CONTENT, viewportHeight: VIEWPORT });

describe('both feed orientations report the same distance from the newest message', () => {
  test('an inverted list measures distance as the raw offset', () => {
    expect(feedDistanceFromNewest(metrics(0), false)).toBe(0);
    expect(feedDistanceFromNewest(metrics(640), false)).toBe(640);
  });

  test('an upright list measures distance back from the end', () => {
    expect(feedDistanceFromNewest(metrics(maxOffset), true)).toBe(0);
    expect(feedDistanceFromNewest(metrics(maxOffset - 640), true)).toBe(640);
    expect(feedDistanceFromNewest(metrics(0), true)).toBe(maxOffset);
  });

  test('rubber-band overscroll never reports a negative distance', () => {
    expect(feedDistanceFromNewest(metrics(-40), false)).toBe(0);
    expect(feedDistanceFromNewest(metrics(maxOffset + 40), true)).toBe(0);
  });
});

describe('a saved distance restores to the same place in an upright list', () => {
  test('zero distance lands on the newest message', () => {
    expect(uprightScrollOffset(0, CONTENT, VIEWPORT)).toBe(maxOffset);
  });

  test('a saved distance round-trips through both directions', () => {
    for (const distance of [0, 120, 640, maxOffset]) {
      const offset = uprightScrollOffset(distance, CONTENT, VIEWPORT);
      expect(feedDistanceFromNewest(metrics(offset), true)).toBe(distance);
    }
  });

  test('a distance longer than the history clamps to the top instead of going negative', () => {
    expect(uprightScrollOffset(99_999, CONTENT, VIEWPORT)).toBe(0);
  });

  test('an unmeasured viewport still scrolls toward the newest end', () => {
    expect(uprightScrollOffset(0, CONTENT, 0)).toBe(CONTENT);
  });
});

const restore = (over: Partial<Parameters<typeof planUprightRestore>[0]> = {}) => planUprightRestore({
  loaded: true, restoredSaved: false, savedDistance: 0, userDragged: false, atNewest: true, ...over,
});

describe('an upright feed lands on the newest message and stays put once the reader takes over', () => {
  test('opening a conversation pins to the newest message as content renders in', () => {
    expect(restore()).toBe('newest');
  });

  test('it keeps pinning even when growth has pushed the measured position off the end', () => {
    expect(restore({ atNewest: false })).toBe('newest');
  });

  test('a dragged-away reader is left alone', () => {
    expect(restore({ atNewest: false, userDragged: true })).toBe('skip');
  });

  test('scrolling back to the newest message makes it sticky again', () => {
    expect(restore({ userDragged: true, atNewest: true })).toBe('newest');
  });

  test('a saved position wins once, then stops fighting the reader', () => {
    expect(restore({ savedDistance: 500, atNewest: false })).toBe('saved');
    expect(restore({ savedDistance: 500, atNewest: false, restoredSaved: true })).toBe('skip');
  });

  test('nothing moves until the saved position has been read back', () => {
    expect(restore({ loaded: false })).toBe('skip');
  });
});

describe('an upright feed renders its first batch at the newest end', () => {
  test('a conversation longer than one batch starts that batch at the last rows', () => {
    expect(initialUprightIndex(20, 12)).toBe(8);
    expect(initialUprightIndex(200, 12)).toBe(188);
  });

  test('a conversation that fits in one batch starts at the top', () => {
    expect(initialUprightIndex(12, 12)).toBe(0);
    expect(initialUprightIndex(3, 12)).toBe(0);
    expect(initialUprightIndex(0, 12)).toBe(0);
  });

  test('the index always leaves a full batch of rows to render', () => {
    for (const count of [13, 40, 999]) {
      expect(count - initialUprightIndex(count, 12)).toBe(12);
    }
  });
});

describe('an upright feed paints its loaded rows in one pass', () => {
  test('a page-sized conversation renders every row in the first batch', () => {
    expect(uprightFirstBatch(20)).toBe(20);
    expect(initialUprightIndex(20, uprightFirstBatch(20))).toBe(0);
  });

  test('a nearly empty conversation still asks for the minimum batch', () => {
    expect(uprightFirstBatch(0)).toBe(FEED_MIN_BATCH);
    expect(uprightFirstBatch(4)).toBe(FEED_MIN_BATCH);
  });

  test('a long history is capped so the first paint stays affordable', () => {
    expect(uprightFirstBatch(500)).toBe(FEED_MAX_FIRST_PAINT);
    expect(initialUprightIndex(500, uprightFirstBatch(500))).toBe(500 - FEED_MAX_FIRST_PAINT);
  });
});

describe('older pages load when the reader asks, not while the feed is settling', () => {
  const metrics = (offset: number, contentHeight: number) => ({ offset, contentHeight, viewportHeight: 800 });

  test('nothing pages until the feed has taken its opening position', () => {
    expect(shouldPageOlder(metrics(0, 3000), false)).toBe(false);
  });

  test('a feed resting on the newest message does not page', () => {
    expect(shouldPageOlder(metrics(2200, 3000), true)).toBe(false);
  });

  test('a reader near the oldest loaded row pages', () => {
    expect(shouldPageOlder(metrics(0, 3000), true)).toBe(true);
    expect(shouldPageOlder(metrics(400, 3000), true)).toBe(true);
  });

  test('a feed with nothing to scroll fills itself', () => {
    expect(shouldPageOlder(metrics(0, 500), true)).toBe(true);
  });
});
