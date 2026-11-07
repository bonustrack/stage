import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { feedOrientation as inverted } from '../components/conversation/feedOrientation';
import type { FeedScrollState } from '../components/conversation/feedOrientation.core';
import type { VirtualListHandle } from '../components/layout/VirtualList.types';

const frames: (() => void)[] = [];
const scrolled: number[] = [];
const list: VirtualListHandle = {
  scrollToOffset: ({ offset }) => {
    scrolled.push(offset);
  },
  scrollToEnd: () => undefined,
  scrollToIndex: () => undefined,
  visibleAnchor: () => null,
  scrollToAnchor: () => false,
};

function state(over: Partial<FeedScrollState> = {}): FeedScrollState {
  return {
    list: { current: list },
    savedDistance: undefined,
    savedAnchor: null,
    savedLoaded: true,
    restored: false,
    pinUntil: 0,
    atNewest: true,
    viewportHeight: 0,
    userDragged: false,
    metrics: { offset: 0, contentHeight: 0, viewportHeight: 0 },
    positioned: false,
    settleUntil: 0,
    olderPending: false,
    ...over,
  };
}

function runFrames(): void {
  for (const frame of frames.splice(0)) frame();
}

beforeEach(() => {
  frames.length = 0;
  scrolled.length = 0;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    frames.push(() => {
      cb(0);
    });
    return frames.length;
  };
  setSystemTime(new Date('2026-11-01T00:00:00.000Z'));
});

afterEach(() => {
  setSystemTime();
});

describe('an inverted feed restores where the reader left it', () => {
  test('waits for the saved position and for content before it moves', () => {
    expect(inverted.restore(state({ savedLoaded: false }), 900, 3)).toBeNull();
    expect(inverted.restore(state(), 0, 3)).toBeNull();
    expect(inverted.restore(state(), 900, 0)).toBeNull();
    runFrames();
    expect(scrolled).toEqual([]);
  });

  test('a saved offset is applied once, on the next frame, clamped to the content', () => {
    const s = state({ savedDistance: 1200 });
    expect(inverted.restore(s, 900, 3)).toBe(900);
    expect(scrolled).toEqual([]);
    runFrames();
    expect(scrolled).toEqual([900]);
    expect(inverted.restore(s, 1500, 3)).toBeNull();
  });

  test('with nothing saved it pins to the newest message while content renders in, then lets go', () => {
    const s = state();
    expect(inverted.restore(s, 900, 3)).toBe(0);
    expect(inverted.restore(s, 1200, 5)).toBe(0);
    expect(s.restored).toBe(false);
    setSystemTime(new Date(Date.now() + 1300));
    expect(inverted.restore(s, 1400, 6)).toBeNull();
    expect(s.restored).toBe(true);
    runFrames();
    expect(scrolled).toEqual([0, 0]);
  });
});

describe('an inverted feed scrolls to its newest message at offset zero', () => {
  test('scrollToNewest goes to the start of the inverted list', () => {
    inverted.scrollToNewest(list);
    expect(scrolled).toEqual([0]);
  });
});
