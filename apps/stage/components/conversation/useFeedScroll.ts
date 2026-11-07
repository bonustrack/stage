import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { VirtualListHandle, VirtualListProps } from '../layout/VirtualList.types';
import {
  convScrollKey,
  flushScrollOffset,
  getFeedAnchor,
  getScrollOffset,
  markConvAtBottom,
  peekFeedAnchor,
  peekScrollOffset,
  saveFeedAnchor,
  saveScrollOffset,
} from '../../lib/scrollPos';
import { attempt, reported } from '../../lib/errorPolicy';
import { useStableCallback } from '../useStableCallback';
import { feedOrientation } from './feedOrientation';
import { FOLLOW_NEWEST_WITHIN_PX, type FeedScrollState } from './feedOrientation.core';

const JUMP_BUTTON_BEYOND_PX = 12;
const JUMP_HIGHLIGHT_MS = 1800;

type FeedListEvents = Pick<VirtualListProps<HistoryEntry>, 'onLayout' | 'onScroll' | 'onScrollBeginDrag' | 'onContentSizeChange'>;

function newScrollState(list: React.RefObject<VirtualListHandle | null>): FeedScrollState {
  return {
    list,
    savedDistance: undefined,
    savedAnchor: null,
    savedLoaded: false,
    restored: false,
    pinUntil: 0,
    atNewest: true,
    viewportHeight: 0,
    userDragged: false,
    metrics: { offset: 0, contentHeight: 0, viewportHeight: 0 },
    positioned: false,
    settleUntil: 0,
    olderPending: false,
  };
}

function useScrollState(convId: string | undefined): FeedScrollState {
  const list = useRef<VirtualListHandle>(null);
  const [s] = useState(() => newScrollState(list));
  const shownConv = useRef(convId);
  if (shownConv.current !== convId) {
    shownConv.current = convId;
    s.userDragged = false;
    s.positioned = false;
    s.settleUntil = 0;
    s.olderPending = false;
  }
  useLayoutEffect(() => {
    if (!convId) return;
    const key = convScrollKey(convId);
    s.atNewest = true;
    s.restored = false;
    s.pinUntil = 0;
    const cached = peekScrollOffset(key);
    const cachedAnchor = peekFeedAnchor(convId);
    if (cached !== undefined && cachedAnchor !== undefined) {
      s.savedDistance = cached;
      s.savedAnchor = cachedAnchor;
      s.savedLoaded = true;
    } else {
      void Promise.all([getScrollOffset(key), getFeedAnchor(convId)])
        .then(([o, anchor]) => {
          s.savedDistance = o;
          s.savedAnchor = anchor;
          s.savedLoaded = true;
        })
        .catch(reported('feed.savedPosition'));
    }
    return () => {
      flushScrollOffset(key);
    };
  }, [convId]);
  return s;
}

function useJumpToMessage(s: FeedScrollState, bubbles: readonly HistoryEntry[]) {
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpToMessage = useStableCallback((messageId: string) => {
    const idx = bubbles.findIndex((b) => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => {
      setJumpHighlightId(null);
    }, JUMP_HIGHLIGHT_MS);
    if (idx < 0) return;
    const index = feedOrientation.rowIndexOf(idx, bubbles.length);
    attempt(() => {
      s.list.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    }, 'ui');
  });
  useEffect(
    () => () => {
      if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    },
    [],
  );
  return { jumpHighlightId, jumpToMessage };
}

function useStickyNewest(bubbleCount: number, convId: string | undefined, follow: () => void, s: FeedScrollState): void {
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    prevBubbleCount.current = 0;
  }, [convId]);
  useEffect(() => {
    if (bubbleCount > prevBubbleCount.current && prevBubbleCount.current > 0 && s.atNewest) follow();
    prevBubbleCount.current = bubbleCount;
  }, [bubbleCount, s]);
}

function feedListEvents(
  s: FeedScrollState,
  convId: string | undefined,
  itemCount: number,
  setShowJump: React.Dispatch<React.SetStateAction<boolean>>,
  flushPendingOlder: () => void,
): FeedListEvents {
  const o = feedOrientation;
  const onDistance = (distance: number): void => {
    const next = distance > JUMP_BUTTON_BEYOND_PX;
    setShowJump((prev) => (prev === next ? prev : next));
    const atNewest = distance <= FOLLOW_NEWEST_WITHIN_PX;
    s.atNewest = atNewest;
    if (!convId) return;
    saveScrollOffset(convScrollKey(convId), atNewest ? 0 : distance);
    if (o.keepsAnchor) saveFeedAnchor(convId, atNewest ? null : (s.list.current?.visibleAnchor() ?? null));
  };
  return {
    onLayout: o.measuresViewportOnLayout
      ? (ev) => {
          s.viewportHeight = ev.nativeEvent.layout.height;
        }
      : undefined,
    onScroll: (ev) => {
      const m = ev.nativeEvent;
      s.viewportHeight = m.layoutMeasurement.height;
      s.metrics = { offset: m.contentOffset.y, contentHeight: m.contentSize.height, viewportHeight: m.layoutMeasurement.height };
      flushPendingOlder();
      if (o.settling(s, Date.now())) return;
      onDistance(o.distanceFromNewest(s.metrics));
    },
    onScrollBeginDrag: () => {
      s.userDragged = true;
      s.settleUntil = 0;
    },
    onContentSizeChange: (_w, h) => {
      const applied = o.restore(s, h, itemCount);
      if (applied !== null) s.positioned = true;
      s.metrics = { offset: applied ?? s.metrics.offset, contentHeight: h, viewportHeight: s.viewportHeight };
      flushPendingOlder();
    },
  };
}

export function useFeedScroll(convId: string | undefined, bubbles: readonly HistoryEntry[], loadOlder: () => Promise<void>) {
  const s = useScrollState(convId);
  const [showJump, setShowJump] = useState(false);
  const scrollToNewest = useStableCallback(() => {
    requestAnimationFrame(() => {
      attempt(() => {
        feedOrientation.scrollToNewest(s.list.current);
      }, 'ui');
    });
  });
  const followNewest = useStableCallback(() => {
    s.atNewest = true;
    scrollToNewest();
    setShowJump(false);
  });
  useStickyNewest(bubbles.length, convId, followNewest, s);
  const { jumpHighlightId, jumpToMessage } = useJumpToMessage(s, bubbles);
  const markAtBottom = useCallback(() => {
    s.atNewest = true;
    if (convId) markConvAtBottom(convId);
  }, [convId, s]);
  const flushPendingOlder = (): void => {
    if (!s.olderPending || feedOrientation.defersOlderPage(s.metrics, s.positioned)) return;
    s.olderPending = false;
    setTimeout(() => {
      void loadOlder();
    }, 0);
  };
  const pageOlder = (): void => {
    s.olderPending = feedOrientation.defersOlderPage(s.metrics, s.positioned);
    if (!s.olderPending) void loadOlder();
  };
  return {
    listRef: s.list,
    showJump,
    setShowJump,
    scrollToNewest,
    followNewest,
    markAtBottom,
    jumpHighlightId,
    jumpToMessage,
    pageOlder,
    stickToNewest: () => s.positioned && s.atNewest,
    feedListEvents: feedListEvents(s, convId, bubbles.length, setShowJump, flushPendingOlder),
  };
}
