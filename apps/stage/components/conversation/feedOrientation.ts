import { FEED_MIN_BATCH, FOLLOW_NEWEST_WITHIN_PX, type FeedOrientation, type FeedScrollState } from './feedOrientation.core';

const PIN_NEWEST_MS = 1200;

function restoreDistance(s: FeedScrollState, contentHeight: number, itemCount: number): number | null {
  if (!s.savedLoaded || contentHeight <= 0 || itemCount === 0) return null;
  const saved = s.savedDistance;
  if (saved != null && saved > 0) {
    s.restored = true;
    return Math.min(saved, Math.max(0, contentHeight));
  }
  const now = Date.now();
  if (s.pinUntil === 0) s.pinUntil = now + PIN_NEWEST_MS;
  else if (now > s.pinUntil) return null;
  return 0;
}

function restore(s: FeedScrollState, contentHeight: number, itemCount: number): number | null {
  if (s.restored) return null;
  const distance = restoreDistance(s, contentHeight, itemCount);
  if (distance === null) {
    if (s.pinUntil !== 0) s.restored = true;
    return null;
  }
  requestAnimationFrame(() => {
    s.list.current?.scrollToOffset({ offset: distance, animated: false });
  });
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
