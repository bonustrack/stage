
import { useRef } from 'react';
import { Platform } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Box, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import { isCoarsePointer } from '../../lib/pointer';
import { showsInvertedScrollbar } from './feed-helpers';
import { FeedScrollbar, type FeedScrollbarControl } from './FeedScrollbar';
import { useFeedRenderItem } from './useFeedRenderItem';
import type { useConversationState } from './useConversationState';

export const FEED_SCROLL_ID = 'stage-feed';

type ConvState = ReturnType<typeof useConversationState>;

function handleFeedScroll(c: ConvState, convId: string, y: number): void {
  const next = y > 12;
  c.setShowJump(prev => (prev === next ? prev : next));
  c.isAtBottomRef.current = y <= AT_BOTTOM_THRESHOLD_PX;
  if (convId) saveScrollOffset(convScrollKey(convId), y <= AT_BOTTOM_THRESHOLD_PX ? 0 : y);
}

function restoreFeedScroll(c: ConvState, h: number): void {
  if (c.didRestoreScroll.current) return;
  const plan = planFeedRestore({
    loaded: c.savedScrollLoaded.current, contentHeight: h, itemCount: c.allBubbles.length,
    savedOffset: c.savedScrollRef.current, now: Date.now(),
    pinUntil: c.pinBottomUntil.current, setPinUntil: (t) => { c.pinBottomUntil.current = t; },
  });
  if (plan === 'skip') {
    if (c.pinBottomUntil.current !== 0) c.didRestoreScroll.current = true;
    return;
  }
  const offset = plan === 'bottom' ? 0 : plan.offset;
  if (plan !== 'bottom') c.didRestoreScroll.current = true;
  requestAnimationFrame(() => {
    try { c.listRef.current?.scrollToOffset({ offset, animated: false }); } catch { }
  });
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
  const barControl = useRef<FeedScrollbarControl | null>(null);
  const nativeBar = showsInvertedScrollbar(Platform.OS === 'web', isCoarsePointer());

  if (searchSlot !== undefined) {
    return <Box flex={1} padding={{ top: insets.top + 52 }}>{searchSlot}</Box>;
  }

  return (
    <Box flex={1}>
      <FlatList
        ref={listRef}
        nativeID={FEED_SCROLL_ID}
        data={allBubbles}
        extraData={extraData}
        inverted
        showsVerticalScrollIndicator={nativeBar}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        style={[{ flex: 1 }, WEB_EDGE_SCROLL]}
        windowSize={11}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        onEndReached={() => { void loadOlder(); }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[{ paddingTop: 24 + bottomInset, paddingBottom: insets.top + 52 + 24 }, WEB_EDGE_CONTENT]}
        onScroll={(ev) => {
          const m = ev.nativeEvent;
          handleFeedScroll(c, convId, m.contentOffset.y);
          if (!nativeBar) {
            barControl.current?.update({
              offset: m.contentOffset.y,
              contentHeight: m.contentSize.height,
              viewportHeight: m.layoutMeasurement.height,
            });
          }
        }}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => { restoreFeedScroll(c, h); }}
        onScrollToIndexFailed={() => undefined}
        renderItem={renderItem}
        ListEmptyComponent={status !== 'open' || hasMore ? spinner : null}
        ListFooterComponent={
          <>
            {loadingOlder ? <Box padding={{ y: 16 }} align="center"><Spinner size={20} color={sub} /></Box> : null}
            {!hasMore ? intro : null}
          </>
        }
        keyboardShouldPersistTaps="handled"
      />
      {nativeBar ? null : (
        <FeedScrollbar
          control={barControl} color={fg}
          top={insets.top + 52} bottom={bottomInset}
        />
      )}
    </Box>
  );
}
