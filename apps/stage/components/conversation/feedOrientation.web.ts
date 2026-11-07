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

function planRestore(s: FeedScrollState): 'saved' | 'newest' | 'skip' {
  if (!s.savedLoaded) return 'skip';
  if (!s.restored && s.savedDistance != null && s.savedDistance > 0) return 'saved';
  if (s.atNewest) return 'newest';
  return s.userDragged || s.restored ? 'skip' : 'newest';
}

function restore(s: FeedScrollState, contentHeight: number): number | null {
  const plan = planRestore(s);
  if (plan === 'skip') return null;
  const offset = offsetForDistance(plan === 'saved' ? (s.savedDistance ?? 0) : 0, contentHeight, s.viewportHeight);
  if (plan === 'saved') {
    s.restored = true;
    s.atNewest = false;
    s.settleUntil = Date.now() + RESTORE_SETTLE_MS;
    if (s.savedAnchor !== null && s.list.current?.scrollToAnchor(s.savedAnchor) === true) return offset;
  }
  s.list.current?.scrollToOffset({ offset, animated: false });
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
