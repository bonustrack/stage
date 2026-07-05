
import { FlatList } from 'react-native-gesture-handler';
import { Box } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import { useFeedRenderItem } from './useFeedRenderItem';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;

function handleFeedScroll(c: ConvState, convId: string, y: number): void {
  const next = y > 12;
  c.setShowJump(prev => (prev === next ? prev : next));
  c.isAtBottomRef.current = y <= AT_BOTTOM_THRESHOLD_PX;
  if (convId) saveScrollOffset(convScrollKey(convId), y <= AT_BOTTOM_THRESHOLD_PX ? 0 : y);
}

function restoreFeedScroll(c: ConvState, h: number): void {
  if (c.didRestoreScroll.current || c.listEpoch !== 0) return;
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
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
}): React.ReactElement {
  return (
    <ConversationIntro
      isGroup={c.isGroup} peerAddr={c.peerAddr} groupName={c.groupName} groupImage={c.groupImage}
      groupDescription={c.groupDescription} groupLabels={c.groupLabels} convId={convId}
      head={head} fg={fg} border={border} rowBg={rowBg}
      onPressPeer={(address) => { router.push({ pathname: '/user/[address]', params: { address } }); }}
    />
  );
}

export function ConversationFeed({
  c, convId, dark, head, sub, fg, border, rowBg, insets, router, searchSlot,
}: {
  c: ConvState;
  convId: string;
  dark: boolean;
  head: string; sub: string; fg: string; border: string; rowBg: string;
  insets: { top: number };
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
  searchSlot?: React.ReactNode;
}): React.ReactElement {
  const { loadOlder, hasMore, loadingOlder, status, listEpoch, listRef, allBubbles } = c;
  const { renderItem, extraData } = useFeedRenderItem(c, dark, router);
  const intro = <FeedIntro c={c} convId={convId} head={head} fg={fg} border={border} rowBg={rowBg} router={router} />;
  const spinner = <Box padding={32} align="center"><Spinner size={28} color={head} /></Box>;

  if (searchSlot !== undefined) {
    return <Box flex={1} padding={{ top: insets.top + 52 }}>{searchSlot}</Box>;
  }

  return (
    <FlatList
      key={listEpoch}
      ref={listRef}
      data={allBubbles}
      extraData={extraData}
      inverted
      showsVerticalScrollIndicator={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyExtractor={e => e.id}
      style={{ flex: 1 }}
      windowSize={11}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      onEndReached={() => { void loadOlder(); }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.top + 52 + 24 }}
      onScroll={(ev) => { handleFeedScroll(c, convId, ev.nativeEvent.contentOffset.y); }}
      scrollEventThrottle={16}
      onContentSizeChange={(_w, h) => { restoreFeedScroll(c, h); }}
      onScrollToIndexFailed={() => undefined}
      renderItem={renderItem}
      ListEmptyComponent={status !== 'open' ? spinner : !hasMore ? intro : spinner}
      ListFooterComponent={
        <>
          {loadingOlder ? <Box padding={{ y: 16 }} align="center"><Spinner size={20} color={sub} /></Box> : null}
          {!hasMore ? intro : null}
        </>
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}
