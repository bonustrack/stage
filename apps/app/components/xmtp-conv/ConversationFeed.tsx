/** The inverted message FlatList for the XMTP conversation screen (lint split). */

import { FlatList } from 'react-native-gesture-handler';
import { Box } from '../layout';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import { useFeedRenderItem } from './useFeedRenderItem';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;

export function ConversationFeed({
  c, convId, dark, head, sub, fg, border, rowBg, insets, router, searchSlot,
}: {
  c: ConvState;
  convId: string;
  dark: boolean;
  head: string; sub: string; fg: string; border: string; rowBg: string;
  insets: { top: number };
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
  /** When search is open with a query, this results list REPLACES the message
   *  FlatList in the feed region (same area, below the search topnav). Empty/no
   *  query → undefined, so the normal feed shows. */
  searchSlot?: React.ReactNode;
}): React.ReactElement {
  const {
    loadOlder, hasMore, loadingOlder, status,
    setShowJump, listEpoch, isAtBottomRef,
    peerAddr, isGroup, groupName, groupImage, groupDescription, groupLabels, listRef,
    savedScrollRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil,
    allBubbles,
  } = c;

  /** Stable renderItem + extraData (id→event Map for O(1) reply lookup) —
   *  extracted to a hook so this file stays under the 200-line lint cap. */
  const { renderItem, extraData } = useFeedRenderItem(c, dark, router);

  /** The empty-state intro/hero (avatar + name + bio/description). Shown at the
   *  visual top of the thread once history is exhausted (`hasMore === false`).
   *  Reused in BOTH the footer (non-empty thread) and the empty component
   *  (brand-new channel with zero messages) so the hero always appears before the
   *  first message — not just after a scroll-up happens to flip `hasMore`. */
  const intro = (
    <ConversationIntro
      isGroup={isGroup}
      peerAddr={peerAddr}
      groupName={groupName}
      groupImage={groupImage}
      groupDescription={groupDescription}
      groupLabels={groupLabels}
      convId={convId}
      head={head}
      sub={sub}
      fg={fg}
      border={border}
      rowBg={rowBg}
      onPressPeer={(address) => router.push({ pathname: '/user/[address]', params: { address } })}
    />
  );

  /** Search active → render the results list in the feed region. Pad the top so
   *  rows clear the absolute search topnav (height + status-bar inset). */
  if (searchSlot !== undefined) {
    return (
      <Box flex={1} padding={{ top: insets.top + 52 }}>
        {searchSlot}
      </Box>
    );
  }

  return (
    <FlatList
      key={listEpoch}
      ref={listRef}
      data={allBubbles}
      extraData={extraData}
      inverted
      showsVerticalScrollIndicator={false}
      /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
       *  initial seed lands, scroll stays pinned to the latest message. */
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyExtractor={e => e.id}
      style={{ flex: 1 }}
      /** #5 FlatList perf: bubbles are VARIABLE height so no getItemLayout — but
       *  cap render window + batch size + clip offscreen rows on long threads. */
      windowSize={11}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      /** Inverted: onEndReached fires near the visual TOP (oldest end) → page in
       *  older history. loadOlder appends to the data END (= above the view, no
       *  viewport shift). No-ops while loading / once exhausted (guarded in hook). */
      onEndReached={() => { void loadOlder(); }}
      onEndReachedThreshold={0.5}
      /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
       *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip. */
      contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.top + 52 + 24 }}
      /** Inverted: `contentOffset.y` ~0 at the visual bottom. Hide the jump button
       *  within ~12px of bottom, show it on scroll-up. 16ms throttle = ~1/frame. */
      onScroll={(ev) => {
        const y = ev.nativeEvent.contentOffset.y;
        const next = y> 12;
        setShowJump(prev => (prev === next ? prev : next));
        /** Authoritative at-bottom flag for the unmount flush (beats the debounce race). */
        isAtBottomRef.current = y <= AT_BOTTOM_THRESHOLD_PX;
        /** Persist the inverted offset (debounced). At bottom store sentinel 0
         *  (restore treats <=0 as "land at bottom") so returning shows the newest
         *  even if msgs arrived while away; a concrete old offset would be stale. */
        if (convId) saveScrollOffset(convScrollKey(convId), y <= AT_BOTTOM_THRESHOLD_PX ? 0 : y);
      }}
      scrollEventThrottle={16}
      /** Initial-mount (epoch 0) scroll restore — see planFeedRestore. Restores a
       *  concrete saved offset, or pins to bottom (newest) across a short settle
       *  window for the at-bottom sentinel. Remounts (epoch> 0) skip → land bottom. */
      onContentSizeChange={(_w, h) => {
        if (didRestoreScroll.current || listEpoch !== 0) return;
        const plan = planFeedRestore({
          loaded: savedScrollLoaded.current, contentHeight: h, itemCount: allBubbles.length,
          savedOffset: savedScrollRef.current, now: Date.now(),
          pinUntil: pinBottomUntil.current, setPinUntil: (t) => { pinBottomUntil.current = t; },
        });
        if (plan === 'skip') {
          // Sentinel settle window elapsed → latch so later scrolls aren't yanked.
          if (pinBottomUntil.current !== 0) didRestoreScroll.current = true;
          return;
        }
        const offset = plan === 'bottom' ? 0 : plan.offset;
        if (plan !== 'bottom') didRestoreScroll.current = true;
        requestAnimationFrame(() => {
          try { listRef.current?.scrollToOffset({ offset, animated: false }); } catch { /* reanimated #3670 / best-effort */ }
        });
      }}
      /** Silent fallback — `scrollToIndex` can fire before the target row has
       *  rendered; without this handler RN's red-screen pops on dev. No-op; the
       *  bubble still highlights via `replyTarget`. */
      onScrollToIndexFailed={() => undefined}
      renderItem={renderItem}
      /** Empty thread: still loading → spinner; loaded with zero history
       *  (`hasMore === false`) → show the hero intro so a brand-new channel isn't
       *  blank before its first message; otherwise a brief settling state. */
      ListEmptyComponent={
        status !== 'open'
          ? <Box padding={32} align="center"><Spinner size={28} color={head} /></Box>
          : hasMore === false
            ? intro
            : <Box padding={32} align="center"><Spinner size={28} color={head} /></Box>
      }
      /** Inverted list → `ListFooterComponent` renders at the visual TOP (oldest
       *  end). Holds two things, top-to-bottom: a small "loading older" spinner
       *  while a previous page is paginating in, then the conversation intro
       *  header. The intro only shows once history is exhausted (`!hasMore`) so
       *  it doesn't sit mid-scroll above still-unloaded messages. */
      ListFooterComponent={
        <>
          {loadingOlder ? (
            <Box padding={{ y: 16 }} align="center">
              <Spinner size={20} color={sub} />
            </Box>
          ) : null}
          {hasMore === false ? intro : null}
        </>
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}
