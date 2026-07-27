import { describe, expect, test } from 'bun:test';
import {
  feedDistanceFromNewest, planUprightRestore, uprightScrollOffset,
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
