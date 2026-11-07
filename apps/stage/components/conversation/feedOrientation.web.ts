import type { RefObject } from 'react';
import type { VirtualListHandle } from '../layout/VirtualList.types';
import { FEED_MIN_BATCH, type FeedOrientation, type FeedScrollMetrics, type FeedScrollState } from './feedOrientation.core';

const FEED_MAX_FIRST_PAINT = 60;
const RESTORE_SETTLE_MS = 400;

function offsetForDistance(distanceFromNewest: number, contentHeight: number, viewportHeight: number): number {
  return Math.max(0, contentHeight - viewportHeight - distanceFromNewest);
}

function shouldPageOlder(m: FeedScrollMetrics, positioned: boolean): boolean {
  if (!positioned) return false;
  if (m.contentHeight <= m.viewportHeight) return true;
  return m.offset <= m.viewportHeight / 2;
}

function planRestore(args: {
  loaded: boolean;
  restoredSaved: boolean;
  savedDistance: number | undefined;
  userDragged: boolean;
  atNewest: boolean;
}): 'saved' | 'newest' | 'skip' {
  const { loaded, restoredSaved, savedDistance, userDragged, atNewest } = args;
  if (!loaded) return 'skip';
  if (!restoredSaved && savedDistance != null && savedDistance > 0) return 'saved';
  if (atNewest) return 'newest';
  return userDragged || restoredSaved ? 'skip' : 'newest';
}

function scrollTo(list: RefObject<VirtualListHandle | null>, offset: number): void {
  list.current?.scrollToOffset({ offset, animated: false });
}

function restore(s: FeedScrollState, contentHeight: number): number | null {
  const viewportHeight = s.viewportHeight;
  const plan = planRestore({
    loaded: s.savedLoaded,
    restoredSaved: s.restored,
    savedDistance: s.savedDistance,
    userDragged: s.userDragged,
    atNewest: s.atNewest,
  });
  if (plan === 'skip') return null;
  if (plan === 'saved') {
    s.restored = true;
    s.atNewest = false;
    s.settleUntil = Date.now() + RESTORE_SETTLE_MS;
    const anchor = s.savedAnchor;
    if (anchor !== null && s.list.current?.scrollToAnchor(anchor) === true)
      return offsetForDistance(s.savedDistance ?? 0, contentHeight, viewportHeight);
  }
  const distance = plan === 'saved' ? (s.savedDistance ?? 0) : 0;
  const offset = offsetForDistance(distance, contentHeight, viewportHeight);
  scrollTo(s.list, offset);
  return offset;
}

export const feedOrientation: FeedOrientation = {
  listAnchor: 'end',
  measuresViewportOnLayout: false,
  keepsAnchor: true,
  rows: (newestFirst) => [...newestFirst].reverse(),
  rowIndexOf: (newestFirstIndex, count) => count - 1 - newestFirstIndex,
  firstBatch: (rowCount) => Math.min(Math.max(rowCount, FEED_MIN_BATCH), FEED_MAX_FIRST_PAINT),
  distanceFromNewest: (m) => Math.max(0, m.contentHeight - m.viewportHeight - m.offset),
  positionHold: () => ({ minIndexForVisible: 0 }),
  orient: (loadOlder, headPad, footPad, olderEdge) => ({
    inverted: false,
    onStartReached: loadOlder,
    contentPadding: { paddingTop: headPad, paddingBottom: footPad, flexGrow: 1, justifyContent: 'flex-end' },
    header: olderEdge,
  }),
  defersOlderPage: (m, positioned) => !shouldPageOlder(m, positioned),
  settling: (s, now) => !s.positioned || now < s.settleUntil,
  restore,
  scrollToNewest: (list) => {
    list?.scrollToEnd({ animated: false });
  },
};
