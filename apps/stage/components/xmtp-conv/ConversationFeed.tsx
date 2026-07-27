
import { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Box, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import { feedDistanceFromNewest, planUprightRestore, uprightScrollOffset } from './feed-helpers';
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
  requestAnimationFrame(() => {
    try { c.listRef.current?.scrollToOffset({ offset, animated: false }); } catch { }
  });
}

function restoreUprightScroll(
  c: ConvState, contentHeight: number, viewportHeight: number, userDragged: boolean,
): void {
  const plan = planUprightRestore({
    loaded: c.savedScrollLoaded.current,
    restoredSaved: c.didRestoreScroll.current,
    savedDistance: c.savedScrollRef.current,
    userDragged,
    atNewest: c.isAtBottomRef.current,
  });
  if (plan === 'skip') return;
  if (plan === 'saved') c.didRestoreScroll.current = true;
  const distance = plan === 'saved' ? c.savedScrollRef.current ?? 0 : 0;
  scrollFeedTo(c, uprightScrollOffset(distance, contentHeight, viewportHeight));
}

function restoreFeedScroll(
  c: ConvState, contentHeight: number, viewportHeight: number, userDragged: boolean,
): void {
  if (UPRIGHT) { restoreUprightScroll(c, contentHeight, viewportHeight, userDragged); return; }
  if (c.didRestoreScroll.current) return;
  const plan = planFeedRestore({
    loaded: c.savedScrollLoaded.current, contentHeight, itemCount: c.allBubbles.length,
    savedOffset: c.savedScrollRef.current, now: Date.now(),
    pinUntil: c.pinBottomUntil.current, setPinUntil: (t) => { c.pinBottomUntil.current = t; },
  });
  if (plan === 'skip') {
    if (c.pinBottomUntil.current !== 0) c.didRestoreScroll.current = true;
    return;
  }
  const distance = plan === 'bottom' ? 0 : plan.offset;
  if (plan !== 'bottom') c.didRestoreScroll.current = true;
  scrollFeedTo(c, distance);
}

interface OrientedFeed {
  inverted: boolean;
  onStartReached?: () => void;
  onEndReached?: () => void;
  contentPadding: { paddingTop: number; paddingBottom: number };
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
      contentPadding: { paddingTop: headPad, paddingBottom: footPad },
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
  const rows = useMemo(() => (UPRIGHT ? [...allBubbles].reverse() : allBubbles), [allBubbles]);

  if (searchSlot !== undefined) {
    return <Box flex={1} padding={{ top: insets.top + 52 }}>{searchSlot}</Box>;
  }

  const olderEdge = (
    <>
      {loadingOlder ? <Box padding={{ y: 16 }} align="center"><Spinner size={20} color={sub} /></Box> : null}
      {!hasMore ? intro : null}
    </>
  );
  const o = orientFeed(() => { void loadOlder(); }, insets.top + 52 + 24, 24 + bottomInset, olderEdge);

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
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      onEndReached={o.onEndReached}
      onEndReachedThreshold={0.5}
      onStartReached={o.onStartReached}
      onStartReachedThreshold={0.5}
      contentContainerStyle={[o.contentPadding, WEB_EDGE_CONTENT]}
      onLayout={(ev) => { viewportHeight.current = ev.nativeEvent.layout.height; }}
      onScroll={(ev) => {
        const m = ev.nativeEvent;
        viewportHeight.current = m.layoutMeasurement.height;
        handleFeedScroll(c, convId, feedDistanceFromNewest({
          offset: m.contentOffset.y,
          contentHeight: m.contentSize.height,
          viewportHeight: m.layoutMeasurement.height,
        }, UPRIGHT));
      }}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => { userDragged.current = true; }}
      onContentSizeChange={(_w, h) => { restoreFeedScroll(c, h, viewportHeight.current, userDragged.current); }}
      onScrollToIndexFailed={() => undefined}
      renderItem={renderItem}
      ListEmptyComponent={status !== 'open' || hasMore ? spinner : null}
      ListHeaderComponent={o.header}
      ListFooterComponent={o.footer}
      keyboardShouldPersistTaps="handled"
    />
  );
}
