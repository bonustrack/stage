/** The inverted message FlatList for the XMTP conversation screen (lint split). */

import { Text } from '@metro-labs/kit/text';
import { FlatList } from 'react-native-gesture-handler';
import { Box } from '../layout';
import { MessengerBubble } from '../MessengerBubble';
import { Spinner } from '../Spinner';
import { ConversationIntro } from './ConversationIntro';
import type { SignatureRequestContent } from '@metro-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@metro-labs/client/xmtp/tx';
import { AT_BOTTOM_THRESHOLD_PX, convScrollKey, planFeedRestore, saveScrollOffset } from '../../lib/scrollPos';
import { previewOf } from './feed-helpers';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;

export function ConversationFeed({
  c, convId, dark, head, sub, fg, border, rowBg, insets, router,
}: {
  c: ConvState;
  convId: string;
  dark: boolean;
  head: string; sub: string; fg: string; border: string; rowBg: string;
  insets: { top: number };
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
}): React.ReactElement {
  const {
    events, loadOlder, hasMore, loadingOlder, status, myUri,
    setShowJump, listEpoch, replyingTo, jumpHighlightId, isAtBottomRef,
    confirmedIds, optimisticReactions, optimisticRemovals,
    peerAddr, isGroup, groupName, groupImage, groupDescription, groupLabels,
    senderEthOf, profilesVersion, listRef,
    savedScrollRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil,
    reactions, ownReactions, displayVotes, displayOwnVotes,
    allBubbles, jumpToMessage,
    onReact, onSign, signingIds, onVote, onPay, payingIds, onAnswer,
    setMenuAnchor, setMenuFor, setReplyTarget, selectedForCopy,
  } = c;

  return (
    <FlatList
      key={listEpoch}
      ref={listRef}
      data={allBubbles}
      extraData={[profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, confirmedIds, selectedForCopy, groupDescription, groupLabels]}
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
        const next = y > 12;
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
       *  window for the at-bottom sentinel. Remounts (epoch > 0) skip → land bottom. */
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
      renderItem={({ item }) => (
        <MessengerBubble
          entry={item}
          dark={dark}
          myUri={myUri}
          senderEthAddress={senderEthOf(item.from)}
          onAvatarPress={(addr) => router.push({ pathname: '/user/[address]', params: { address: addr } })}
          unread={false}
          /** Dim ("sending") only while the send is still in flight: an optimistic
           *  entry (id `tmp_…`) whose real id has NOT yet come back from conv.send().
           *  The moment onSent resolves with a sentId we record it in confirmedIds,
           *  which flips this to solid immediately — no waiting for the stream echo
           *  (XMTP self-sends don't reliably replay, esp. in groups). The optimistic
           *  entry is still dropped/merged by id when the live bubble lands, so this
           *  never produces a duplicate. */
          pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
          replyTarget={replyingTo?.id === item.id || jumpHighlightId === item.id}
          reactions={reactions.get(item.id)}
          pendingReactions={optimisticReactions.get(item.id)}
          pendingRemovals={optimisticRemovals.get(item.id)}
          ownEmojis={ownReactions.get(item.id)}
          replyPreview={item.replyTo ? previewOf(events.find(e => e.id === item.replyTo) ?? item) : undefined}
          /** Tap the quoted slab → jump+highlight the original message. */
          onReplyPreviewPress={item.replyTo ? () => jumpToMessage(item.replyTo as string) : undefined}
          votes={displayVotes.get(item.id)}
          ownVotes={displayOwnVotes.get(item.id)}
          onVote={(idx, action) => onVote(item.id, idx, action)}
          signing={signingIds.has(item.id)}
          /** Show "Sign" only on a request from the OTHER party — you don't
           *  sign your own request. */
          onSign={(() => {
            const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
            if (!req || item.from === myUri) return undefined;
            return () => onSign(item.id, req);
          })()}
          paying={payingIds.has(item.id)}
          /** Show "Pay" only on a payment request from the OTHER party — you
           *  don't pay your own request. */
          onPay={(() => {
            const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
            if (!wsc || item.from === myUri) return undefined;
            return () => onPay(item.id, wsc);
          })()}
          onReact={(emoji) => onReact(item.id, emoji)}
          onReply={() => setReplyTarget(item.id, previewOf(item), senderEthOf(item.from))}
          onOpenMenu={(anchor) => { setMenuAnchor(anchor); setMenuFor(item); }}
          onCloseMenu={() => setMenuFor(null)}
          selectable={selectedForCopy === item.id}
          onAnswer={(label) => onAnswer(item.id, label)}
        />
      )}
      ListEmptyComponent={
        <Box style={{ padding: 32, alignItems: 'center' }}>
          {status === 'open'
            ? <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
            : <Spinner size={28} color={head} />}
        </Box>
      }
      /** Inverted list → `ListFooterComponent` renders at the visual TOP (oldest
       *  end). Holds two things, top-to-bottom: a small "loading older" spinner
       *  while a previous page is paginating in, then the conversation intro
       *  header. The intro only shows once history is exhausted (`!hasMore`) so
       *  it doesn't sit mid-scroll above still-unloaded messages. */
      ListFooterComponent={
        <>
          {loadingOlder ? (
            <Box style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Spinner size={20} color={sub} />
            </Box>
          ) : null}
          {hasMore === false ? (
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
          ) : null}
        </>
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}
