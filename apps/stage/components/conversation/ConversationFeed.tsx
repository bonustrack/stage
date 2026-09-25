
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { Box, Col, PANE_LEFT_PAD, VirtualList, viewportFill } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveFeedAnchor, saveScrollOffset } from '../../lib/scrollPos';
import {
  FEED_MIN_BATCH, feedDistanceFromNewest, planUprightRestore,
  shouldPageOlder, uprightFirstBatch, uprightScrollOffset, type FeedScrollMetrics,
} from './feed-helpers';
import { useFeedRenderItem } from './useFeedRenderItem';
import type { useConversationState } from './useConversationState';
import { usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { TOPNAV_HEIGHT } from '../Topnav';
import type { HistoryEntry } from '@stage-labs/client/types';
import { attempt } from '../../lib/errorPolicy';

const UPRIGHT = Platform.OS === 'web';
const FEED_ESTIMATED_ROW = 80;

type ConvState = ReturnType<typeof useConversationState>;

function handleFeedScroll(c: ConvState, convId: string, distance: number): void {
  const next = distance > 12;
  c.setShowJump(prev => (prev === next ? prev : next));
  const atBottom = distance <= AT_BOTTOM_THRESHOLD_PX;
  c.isAtBottomRef.current = atBottom;
  if (!convId) return;
  saveScrollOffset(convScrollKey(convId), atBottom ? 0 : distance);
  if (UPRIGHT) saveFeedAnchor(convId, atBottom ? null : c.listRef.current?.visibleAnchor() ?? null);
}

function scrollFeedTo(c: ConvState, offset: number): void {
  const apply = (): void => {
    attempt(() => { c.listRef.current?.scrollToOffset({ offset, animated: false }); }, 'ui');
  };
  if (UPRIGHT) { apply(); return; }
  requestAnimationFrame(apply);
}

const RESTORE_SETTLE_MS = 400;

function restoreUprightScroll(c: ConvState, contentHeight: number, refs: FeedScrollRefs): number | null {
  const viewportHeight = refs.viewportHeight.current;
  const plan = planUprightRestore({
    loaded: c.savedScrollLoaded.current,
    restoredSaved: c.didRestoreScroll.current,
    savedDistance: c.savedScrollRef.current,
    userDragged: refs.userDragged.current,
    atNewest: c.isAtBottomRef.current,
  });
  if (plan === 'skip') return null;
  if (plan === 'saved') {
    c.didRestoreScroll.current = true;
    c.isAtBottomRef.current = false;
    refs.settleUntil.current = Date.now() + RESTORE_SETTLE_MS;
    const anchor = c.savedAnchorRef.current;
    if (anchor !== null && c.listRef.current?.scrollToAnchor(anchor) === true) return uprightScrollOffset(c.savedScrollRef.current ?? 0, contentHeight, viewportHeight);
  }
  const distance = plan === 'saved' ? c.savedScrollRef.current ?? 0 : 0;
  const offset = uprightScrollOffset(distance, contentHeight, viewportHeight);
  scrollFeedTo(c, offset);
  return offset;
}

function restoreFeedScroll(c: ConvState, contentHeight: number, refs: FeedScrollRefs): number | null {
  if (UPRIGHT) return restoreUprightScroll(c, contentHeight, refs);
  if (c.didRestoreScroll.current) return null;
  const plan = planFeedRestore({
    loaded: c.savedScrollLoaded.current, contentHeight, itemCount: c.allBubbles.length,
    savedOffset: c.savedScrollRef.current, now: Date.now(),
    pinUntil: c.pinBottomUntil.current, setPinUntil: (t) => { c.pinBottomUntil.current = t; },
  });
  if (plan === 'skip') {
    if (c.pinBottomUntil.current !== 0) c.didRestoreScroll.current = true;
    return null;
  }
  const distance = plan === 'bottom' ? 0 : plan.offset;
  if (plan !== 'bottom') c.didRestoreScroll.current = true;
  scrollFeedTo(c, distance);
  return distance;
}

function feedPager(
  loadOlder: () => Promise<void>,
  metrics: React.RefObject<FeedScrollMetrics>,
  positioned: React.RefObject<boolean>,
): () => void {
  return () => {
    if (UPRIGHT && !shouldPageOlder(metrics.current, positioned.current)) return;
    void loadOlder();
  };
}

interface OrientedFeed {
  inverted: boolean;
  onStartReached?: () => void;
  onEndReached?: () => void;
  contentPadding: ViewStyle;
  header?: React.ReactElement;
  footer?: React.ReactElement;
}

function orientFeed(
  loadOlder: () => void, headPad: number, footPad: number, olderEdge: React.ReactElement,
): OrientedFeed {
  if (UPRIGHT) {
    return {
      inverted: false,
      onStartReached: loadOlder,
      contentPadding: {
        paddingTop: headPad, paddingBottom: footPad,
        flexGrow: 1, justifyContent: 'flex-end',
      },
      header: olderEdge,
    };
  }
  return {
    inverted: true,
    onEndReached: loadOlder,
    contentPadding: { paddingTop: footPad, paddingBottom: headPad },
    footer: olderEdge,
  };
}

function FeedOlderEdge({ loading, sub, hasMore, intro }: {
  loading: boolean; sub: string; hasMore: boolean; intro: React.ReactElement;
}): React.ReactElement {
  return (
    <>
      {loading ? <Box padding={{ y: 16 }} align="center"><Spinner size={20} color={sub} /></Box> : null}
      {!hasMore ? intro : null}
    </>
  );
}

interface FeedScrollRefs {
  viewportHeight: React.MutableRefObject<number>;
  userDragged: React.MutableRefObject<boolean>;
  metrics: React.MutableRefObject<FeedScrollMetrics>;
  positioned: React.MutableRefObject<boolean>;
  settleUntil: React.MutableRefObject<number>;
}

function useFeedScrollRefs(convId: string): FeedScrollRefs {
  const viewportHeight = useRef(0);
  const userDragged = useRef(false);
  const metrics = useRef<FeedScrollMetrics>({ offset: 0, contentHeight: 0, viewportHeight: 0 });
  const positioned = useRef(false);
  const settleUntil = useRef(0);
  const shownConv = useRef(convId);
  if (shownConv.current !== convId) {
    shownConv.current = convId;
    userDragged.current = false;
    positioned.current = false;
    settleUntil.current = 0;
  }
  return { viewportHeight, userDragged, metrics, positioned, settleUntil };
}

function feedScrollEvents(c: ConvState, convId: string, refs: FeedScrollRefs): Pick<
  React.ComponentProps<typeof VirtualList<HistoryEntry>>, 'onLayout' | 'onScroll' | 'onScrollBeginDrag' | 'onContentSizeChange'
> {
  const { viewportHeight, userDragged, metrics, positioned, settleUntil } = refs;
  return {
    onLayout: UPRIGHT ? undefined : (ev) => { viewportHeight.current = ev.nativeEvent.layout.height; },
    onScroll: (ev) => {
      const m = ev.nativeEvent;
      viewportHeight.current = m.layoutMeasurement.height;
      metrics.current = { offset: m.contentOffset.y, contentHeight: m.contentSize.height, viewportHeight: m.layoutMeasurement.height };
      if (UPRIGHT && (!positioned.current || Date.now() < settleUntil.current)) return;
      handleFeedScroll(c, convId, feedDistanceFromNewest(metrics.current, UPRIGHT));
    },
    onScrollBeginDrag: () => { userDragged.current = true; settleUntil.current = 0; },
    onContentSizeChange: (_w, h) => {
      const applied = restoreFeedScroll(c, h, refs);
      if (applied !== null) positioned.current = true;
      metrics.current = { offset: applied ?? metrics.current.offset, contentHeight: h, viewportHeight: viewportHeight.current };
    },
  };
}

const LOADER_DELAY_MS = 180;
let feedShownOnce = false;

function useSlowOpen(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) { feedShownOnce = true; setSlow(false); return; }
    const timer = setTimeout(() => { setSlow(true); }, LOADER_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [waiting]);
  return slow || !feedShownOnce;
}

export function ConversationFeed({ c, convId, bottomInset = 0, searchSlot }: {
  c: ConvState;
  convId: string;
  bottomInset?: number;
  searchSlot?: React.ReactNode;
}): React.ReactElement {
  const { loadOlder, hasMore, loadingOlder, status, listRef, allBubbles } = c;
  const { text: sub, link: head } = usePalette();
  const topPad = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const { renderItem, extraData } = useFeedRenderItem(c);
  const intro = <ConversationIntro c={c} convId={convId} />;
  const refs = useFeedScrollRefs(convId);
  const { metrics, positioned } = refs;
  const rows = useMemo(() => (UPRIGHT ? [...allBubbles].reverse() : allBubbles), [allBubbles]);
  const empty = rows.length === 0 && (status !== 'open' || hasMore);
  const slowOpen = useSlowOpen(empty);

  if (searchSlot !== undefined) {
    return <Box flex={1} padding={{ top: topPad }}>{searchSlot}</Box>;
  }

  if (empty) {
    return (
      <Col flex={1} align="center" justify="center" style={[viewportFill(), PANE_LEFT_PAD]}>
        {slowOpen ? <Spinner size={28} color={head} /> : null}
      </Col>
    );
  }

  const olderEdge = (
    <FeedOlderEdge loading={loadingOlder && c.showJump} sub={sub} hasMore={hasMore} intro={intro} />
  );
  const firstBatch = UPRIGHT ? uprightFirstBatch(rows.length) : FEED_MIN_BATCH;
  const o = orientFeed(
    feedPager(loadOlder, metrics, positioned),
    topPad + 24, 24 + bottomInset, olderEdge,
  );

  return (
    <VirtualList
      key={convId}
      ref={listRef}
      data={rows}
      extraData={extraData}
      inverted={o.inverted}
      anchor={UPRIGHT ? 'end' : 'start'}
      stickToEnd={() => positioned.current && c.isAtBottomRef.current}
      estimatedItemSize={FEED_ESTIMATED_ROW}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyExtractor={c.rowKeyOf}
      windowSize={11}
      initialNumToRender={firstBatch}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      onEndReached={o.onEndReached}
      onEndReachedThreshold={0.5}
      onStartReached={o.onStartReached}
      onStartReachedThreshold={0.5}
      contentContainerStyle={o.contentPadding}
      {...feedScrollEvents(c, convId, refs)}
      scrollEventThrottle={16}
      onScrollToIndexFailed={() => undefined}
      renderItem={renderItem}
      ListHeaderComponent={o.header}
      ListFooterComponent={o.footer}
      keyboardShouldPersistTaps="handled"
    />
  );
}
