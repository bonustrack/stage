import type { RefObject } from 'react';
import { attempt } from '../../lib/errorPolicy';
import type { VirtualListHandle } from '../layout/VirtualList.types';
import { FEED_MIN_BATCH, FOLLOW_NEWEST_WITHIN_PX, type FeedOrientation, type FeedScrollState } from './feedOrientation.core';

const PIN_NEWEST_MS = 1200;

function planRestore(args: {
  loaded: boolean;
  contentHeight: number;
  itemCount: number;
  savedOffset: number | undefined;
  now: number;
  pinUntil: number;
  setPinUntil: (t: number) => void;
}): 'skip' | 'bottom' | { offset: number; done: true } {
  const { loaded, contentHeight, itemCount, savedOffset, now, pinUntil, setPinUntil } = args;
  if (!loaded || contentHeight <= 0 || itemCount === 0) return 'skip';
  if (savedOffset == null || savedOffset <= 0) {
    if (pinUntil === 0) {
      setPinUntil(now + PIN_NEWEST_MS);
      return 'bottom';
    }
    return now > pinUntil ? 'skip' : 'bottom';
  }
  return { offset: Math.min(savedOffset, Math.max(0, contentHeight)), done: true };
}

function scrollTo(list: RefObject<VirtualListHandle | null>, offset: number): void {
  requestAnimationFrame(() => {
    attempt(() => {
      list.current?.scrollToOffset({ offset, animated: false });
    }, 'ui');
  });
}

function restore(s: FeedScrollState, contentHeight: number, itemCount: number): number | null {
  if (s.restored) return null;
  const plan = planRestore({
    loaded: s.savedLoaded,
    contentHeight,
    itemCount,
    savedOffset: s.savedDistance,
    now: Date.now(),
    pinUntil: s.pinUntil,
    setPinUntil: (t) => {
      s.pinUntil = t;
    },
  });
  if (plan === 'skip') {
    if (s.pinUntil !== 0) s.restored = true;
    return null;
  }
  const distance = plan === 'bottom' ? 0 : plan.offset;
  if (plan !== 'bottom') s.restored = true;
  scrollTo(s.list, distance);
  return distance;
}

export const feedOrientation: FeedOrientation = {
  listAnchor: 'start',
  measuresViewportOnLayout: true,
  keepsAnchor: false,
  rows: (newestFirst) => newestFirst,
  rowIndexOf: (newestFirstIndex) => newestFirstIndex,
  firstBatch: () => FEED_MIN_BATCH,
  distanceFromNewest: (m) => Math.max(0, m.offset),
  positionHold: (awayFromNewest) =>
    awayFromNewest ? { minIndexForVisible: 0, autoscrollToTopThreshold: FOLLOW_NEWEST_WITHIN_PX } : undefined,
  orient: (loadOlder, headPad, footPad, olderEdge) => ({
    inverted: true,
    onEndReached: loadOlder,
    contentPadding: { paddingTop: footPad, paddingBottom: headPad },
    footer: olderEdge,
  }),
  defersOlderPage: () => false,
  settling: () => false,
  restore,
  scrollToNewest: (list) => {
    list?.scrollToOffset({ offset: 0, animated: false });
  },
};
