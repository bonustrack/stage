
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Box, WebFullBleed, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT_WIDE } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import {
  FEED_MIN_BATCH, feedDistanceFromNewest, initialUprightIndex, planUprightRestore,
  shouldPageOlder, uprightFirstBatch, uprightScrollOffset, type FeedScrollMetrics,
} from './feed-helpers';
import { useFeedRenderItem } from './useFeedRenderItem';
import type { useConversationState } from './useConversationState';

const UPRIGHT = Platform.OS === 'web';

type ConvState = ReturnType<typeof useConversationState>;

function handleFeedScroll(c: ConvState, convId: string, distance: number): void {
  const next = distance > 12;
  c.setShowJump(prev => (prev === next ? prev : next));
  c.isAtBottomRef.current = distance <= AT_BOTTOM_THRESHOLD_PX;
  if (convId) saveScrollOffset(convScrollKey(convId), distance <= AT_BOTTOM_THRESHOLD_PX ? 0 : distance);
}

function scrollFeedTo(c: ConvState, offset: number): void {
  const apply = (): void => {
    try { c.listRef.current?.scrollToOffset({ offset, animated: false }); } catch { }
  };
  if (UPRIGHT) { apply(); return; }
  requestAnimationFrame(apply);
}

function restoreUprightScroll(
  c: ConvState, contentHeight: number, viewportHeight: number, userDragged: boolean,
): number | null {
  const plan = planUprightRestore({
    loaded: c.savedScrollLoaded.current,
    restoredSaved: c.didRestoreScroll.current,
    savedDistance: c.savedScrollRef.current,
    userDragged,
    atNewest: c.isAtBottomRef.current,
  });
  if (plan === 'skip') return null;
  if (plan === 'saved') c.didRestoreScroll.current = true;
  const distance = plan === 'saved' ? c.savedScrollRef.current ?? 0 : 0;
  const offset = uprightScrollOffset(distance, contentHeight, viewportHeight);
  scrollFeedTo(c, offset);
  return offset;
}

function restoreFeedScroll(
  c: ConvState, contentHeight: number, viewportHeight: number, userDragged: boolean,
): number | null {
  if (UPRIGHT) return restoreUprightScroll(c, contentHeight, viewportHeight, userDragged);
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

const LOADER_DELAY_MS = 180;

function useSlowOpen(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) { setSlow(false); return; }
    const timer = setTimeout(() => { setSlow(true); }, LOADER_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [waiting]);
  return slow;
}

function FeedIntro({ c, convId, head, fg, border, rowBg, router }: {
  c: ConvState; convId: string; head: string; fg: string; border: string; rowBg: string;
  router: { push: (h: { pathname: '/profile/[address]'; params: { address: string } }) => void };
}): React.ReactElement {
  return (
    <ConversationIntro
      isGroup={c.isGroup} peerAddr={c.peerAddr} groupName={c.groupName} groupImage={c.groupImage}
      groupDescription={c.groupDescription} groupLabels={c.groupLabels} convId={convId}
      head={head} fg={fg} border={border} rowBg={rowBg}
      onPressPeer={(address) => { router.push({ pathname: '/profile/[address]', params: { address } }); }}
    />
  );
}

export function ConversationFeed({
  c, convId, dark, head, sub, fg, border, rowBg, insets, bottomInset = 0, router, searchSlot,
}: {
  c: ConvState;
  convId: string;
  dark: boolean;
  head: string; sub: string; fg: string; border: string; rowBg: string;
  insets: { top: number };
  bottomInset?: number;
  router: { push: (h: { pathname: '/profile/[address]'; params: { address: string } }) => void };
  searchSlot?: React.ReactNode;
}): React.ReactElement {
  const { loadOlder, hasMore, loadingOlder, status, listRef, allBubbles } = c;
  const { renderItem, extraData } = useFeedRenderItem(c, dark, router);
  const intro = <FeedIntro c={c} convId={convId} head={head} fg={fg} border={border} rowBg={rowBg} router={router} />;
  const spinner = <Box padding={32} align="center"><Spinner size={28} color={head} /></Box>;
  const viewportHeight = useRef(0);
  const userDragged = useRef(false);
  const metrics = useRef<FeedScrollMetrics>({ offset: 0, contentHeight: 0, viewportHeight: 0 });
  const positioned = useRef(false);
  const rows = useMemo(() => (UPRIGHT ? [...allBubbles].reverse() : allBubbles), [allBubbles]);
  const empty = rows.length === 0 && (status !== 'open' || hasMore);
  const slowOpen = useSlowOpen(empty);

  if (searchSlot !== undefined) {
    return (
      <WebFullBleed>
        <Box flex={1} padding={{ top: insets.top + 52 }}>{searchSlot}</Box>
      </WebFullBleed>
    );
  }

  if (empty) {
    return (
      <WebFullBleed>
        <Box flex={1} padding={{ top: insets.top + 52 }}>{slowOpen ? spinner : null}</Box>
      </WebFullBleed>
    );
  }

  const olderEdge = (
    <FeedOlderEdge loading={loadingOlder && c.showJump} sub={sub} hasMore={hasMore} intro={intro} />
  );
  const firstBatch = UPRIGHT ? uprightFirstBatch(rows.length) : FEED_MIN_BATCH;
  const o = orientFeed(
    feedPager(loadOlder, metrics, positioned),
    insets.top + 52 + 24, 24 + bottomInset, olderEdge,
  );

  return (
    <FlatList
      ref={listRef}
      data={rows}
      extraData={extraData}
      inverted={o.inverted}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyExtractor={e => e.id}
      style={[{ flex: 1 }, WEB_EDGE_SCROLL]}
      windowSize={11}
      initialNumToRender={firstBatch}
      initialScrollIndex={UPRIGHT ? initialUprightIndex(rows.length, firstBatch) : undefined}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      onEndReached={o.onEndReached}
      onEndReachedThreshold={0.5}
      onStartReached={o.onStartReached}
      onStartReachedThreshold={0.5}
      contentContainerStyle={[o.contentPadding, WEB_EDGE_CONTENT_WIDE]}
      onLayout={(ev) => { viewportHeight.current = ev.nativeEvent.layout.height; }}
      onScroll={(ev) => {
        const m = ev.nativeEvent;
        viewportHeight.current = m.layoutMeasurement.height;
        metrics.current = {
          offset: m.contentOffset.y,
          contentHeight: m.contentSize.height,
          viewportHeight: m.layoutMeasurement.height,
        };
        handleFeedScroll(c, convId, feedDistanceFromNewest(metrics.current, UPRIGHT));
      }}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => { userDragged.current = true; }}
      onContentSizeChange={(_w, h) => {
        const applied = restoreFeedScroll(c, h, viewportHeight.current, userDragged.current);
        if (applied !== null) positioned.current = true;
        metrics.current = {
          offset: applied ?? metrics.current.offset,
          contentHeight: h,
          viewportHeight: viewportHeight.current,
        };
      }}
      onScrollToIndexFailed={() => undefined}
      renderItem={renderItem}
      ListHeaderComponent={o.header}
      ListFooterComponent={o.footer}
      keyboardShouldPersistTaps="handled"
    />
  );
}
