/** XMTP conversation view — opened from the messenger tab list. State + handlers
 *  live in useConversationState; presentational pieces in components/xmtp-conv. */

import { useCallback, useEffect, useState } from 'react';

import { Animated as RNAnimated, Share } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getPeerName } from '../../lib/peerProfiles';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { Icon } from '@metro-labs/kit/icon';
import { ChannelMenu } from '../../components/ChannelMenu';
import { isPinned } from '../../lib/pins';
import { isArchived, loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { shortAddress } from '../../modules/messaging';
import { getCachedRows } from '../../modules/messaging';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { HeaderAvatar, BubbleActionMenu, GithubNavButton } from '../../components/xmtp-conv/parts';
import { previewOf } from '../../components/xmtp-conv/feed-helpers';
import { ConversationFeed } from '../../components/xmtp-conv/ConversationFeed';
import { useConversationState } from '../../components/xmtp-conv/useConversationState';
import { RequestActionBar } from '../../components/RequestActionBar';

export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, toolbarBg } = usePalette();
  const sub = fg, rowBg = border;
  const { convId, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const c = useConversationState(convId, focus);
  const {
    activeLine, autoFocusNonce,
    showJump, setShowJump, setListEpoch,
    replyingTo, setReplyingTo, setReplyTarget,
    menuFor, setMenuFor, menuAnchor, overflowOpen, setOverflowOpen, setSelectedForCopy,
    peerAddr, groupName, groupImage, isGroup, github, senderEthOf,
    mentionCandidates, onReact, onOptimistic, onSent, jumpToMessage, markAtBottom,
  } = c;

  /** Message-request gate. The overwhelmingly common case is an already-accepted
   *  channel, so we DEFAULT to showing the composer immediately on open (no
   *  flash). Consent resolves asynchronously; only if it comes back as a pending
   *  request ('unknown') do we hide the composer and swap in the Approve/Reject
   *  bar. A rare incoming request may briefly show the composer before the bar
   *  appears, an acceptable tradeoff to never flash the common case. */
  const [requestPending, setRequestPending] = useState(false);
  const onRequestPending = useCallback((pending: boolean) => setRequestPending(pending), []);

  /** Reactive archived flag so the overflow menu shows Unarchive immediately
   *  (the store loads async; a bare sync read can miss the first paint). */
  const [archived, setArchived] = useState(convId ? isArchived(convId) : false);
  useEffect(() => {
    const sync = (): void => setArchived(convId ? isArchived(convId) : false);
    void loadArchivedIds().then(sync);
    return subscribeArchived(sync);
  }, [convId]);

  const insets = useSafeAreaInsets();
  /** Reanimated keyboard offset shared with the composer's KeyboardStickyView so the
   *  FlatList wrapper lifts in lockstep. Match the composer's `height - insets.bottom`
   *  translate (subtract insets.bottom too) or the feed overshoots. Clamp ≥0. */
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom) }));

  if (!convId) {
    return (
      <Box style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Text color={sub}>Missing conversation id.</Text>
      </Box>
    );
  }

  return (
    <RNAnimated.View
      style={{
        flex: 1, backgroundColor: bg, paddingBottom: insets.bottom,
      }}
    >
      {/** Swipe-back handled by the @react-navigation/stack JS card stack
       *   (app/_layout): its left-edge rightward gesture pops + composes with
       *   the inverted FlatList scroll + leftward bubble swipe-to-reply. */}
      <Reanimated.View style={[{ flex: 1 }, listWrapperStyle]}>
      <ConversationFeed
        c={c}
        convId={convId}
        dark={dark}
        head={head}
        sub={sub}
        fg={fg}
        border={border}
        rowBg={rowBg}
        insets={insets}
        router={router}
      />
      </Reanimated.View>
      {/** Top nav: solid bg strip mirrors the composer footer + extends UP over the
       *  status-bar area so content sliding under the keyboard doesn't show through. */}
      <Box style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        height: 52 + insets.top, paddingTop: insets.top, backgroundColor: toolbarBg,
        flexDirection: 'row', alignItems: 'stretch',
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable
          onPress={() => router.replace('/')}
          style={{ paddingLeft: 14, paddingRight: 8, justifyContent: 'center' }}
        >
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        {/** Everything right of the back arrow is one tap target → group/channel
         *   detail (or peer profile for a DM); fills full height + width. */}
        <Pressable
          onPress={() => {
            if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId: convId ?? '' } });
            else if (peerAddr) router.push({ pathname: '/user/[address]', params: { address: peerAddr } });
          }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
        >
          <HeaderAvatar peerAddr={peerAddr} groupImage={groupImage} channelId={convId} isGroup={isGroup} border={border} />
          <Text weight="semibold" size="4xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
            {isGroup ? (groupName === null ? '' : (groupName || 'Untitled group'))
              : peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : ''}
          </Text>
        </Pressable>
        {/** Topnav links (groups only): GitHub issue/PR, then overflow. */}
        {isGroup && github ? <GithubNavButton url={github} color={fg} /> : null}
        <Pressable
          onPress={() => setOverflowOpen(true)}
          hitSlop={8}
          style={{ paddingHorizontal: 14, justifyContent: 'center' }}
        >
          <Icon name="dotsVertical" size={22} color={fg} />
        </Pressable>
      </Box>
      {/** Fade strip below the top nav — mirrors the composer's top fade. Start it 1px
       *  higher so its solid-bg top edge overlaps the nav bottom, closing the hairline
       *  seam between the two absolute bg layers, then ramps to transparent. */}
      <ComposerGradient bg={bg} direction="up" top={52 + insets.top - 1} height={24} />
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Box>
      {/** Jump-to-bottom: anchored above the composer (bottom:'100%') inside the
       *   KeyboardStickyView so it tracks composer height + keyboard. Bumping the
       *   FlatList key remounts → inverted offset 0 = newest at the bottom. */}
      {showJump ? (
        <Pressable
          onPress={() => { markAtBottom(); setListEpoch(e => e + 1); setShowJump(false); }}
          style={{
            position: 'absolute', alignSelf: 'center', bottom: '100%', marginBottom: 8, zIndex: 3,
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: dark ? rowBg : '#000000',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="arrowDown" size={18} color="#ffffff" />
        </Pressable>
      ) : null}
      {/** Message-request gate: RequestActionBar resolves the conversation's
       *   consent state async and reports it via onPending. Composer shows by
       *   default; only a confirmed pending request hides it + renders the
       *   Approve/Reject row in its place. */}
      <RequestActionBar convId={convId ?? ''} dark={dark} onPending={onRequestPending} />
      {!requestPending ? (
        <MessengerComposer
          dark={dark}
          xmtpLine={activeLine}
          mentionCandidates={mentionCandidates}
          replyingTo={replyingTo ?? undefined}
          autoFocusNonce={autoFocusNonce}
          onClearReply={() => setReplyingTo(null)}
          onJumpToReply={jumpToMessage}
          onOptimistic={onOptimistic}
          onSent={onSent}
        />
      ) : null}
      </Box>
      </KeyboardStickyView>
      {/** Overlays — portals/bottom-sheets render here, outside the feed column. */}
      <ChannelMenu
        visible={overflowOpen}
        convId={convId ?? ''}
        title={isGroup ? (groupName || undefined) : (peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : undefined)}
        isGroup={isGroup}
        peerAddress={peerAddr}
        isUnread={(getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0) > 0}
        isPinned={convId ? isPinned(convId) : false}
        isArchived={archived}
        onClose={() => setOverflowOpen(false)}
        context="view"
        onAfterLeave={result => flash(result === 'left' ? 'Left group' : 'Group hidden')}
      />
      <BubbleActionMenu
        target={menuFor}
        anchor={menuAnchor}
        dark={dark}
        onClose={() => setMenuFor(null)}
        onReact={emoji => { if (menuFor) onReact(menuFor.id, emoji); setMenuFor(null); }}
        onReply={() => {
          if (menuFor) setReplyTarget(menuFor.id, previewOf(menuFor), senderEthOf(menuFor.from));
          setMenuFor(null);
        }}
        onCopy={() => {
          if (menuFor?.text) void Clipboard.setStringAsync(menuFor.text);
          setMenuFor(null);
        }}
        onSelect={() => {
          /** Flip this message into a selectable <Text> for partial-copy handles. */
          if (menuFor) setSelectedForCopy(menuFor.id);
          setMenuFor(null);
        }}
        onShareLink={() => {
          /** Shareable permalink to this message. Opens the conversation on the
           *  web today; the metro:// universal-link handling is the follow-up. */
          if (menuFor) void Share.share({ message: `https://metro.box/#/xmtp/${convId}?m=${menuFor.id}` });
          setMenuFor(null);
        }}
      />
    </RNAnimated.View>
  );
}
