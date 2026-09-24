
import { Share } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, pinnedTop } from '../layout';
import type { Input } from '@stage-labs/kit/react-native/input';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { convTitle } from './convTitle';
import { MessengerComposer } from '../composer/MessengerComposer';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ChannelMenu } from '../ChannelMenu';
import { menuPointOf } from '../AnchoredMenu';
import { isPinned } from '../../lib/pins';
import { getCachedRows, useGroupWaiting } from '../../modules/messaging';
import { GroupWaitingNotice } from './GroupWaitingNotice';
import { capabilities } from '../../lib/capabilities';
import { BubbleActionMenu, ConvTopnavIdentity, ConvTopnavShell } from './parts';
import { previewOf } from './feed-helpers';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { RequestActionBar } from '../RequestActionBar';
import type { useConversationState } from './useConversationState';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { conversationSharePath, profileLinkOf } from '../../lib/links';
import { shareUrlFor } from '@stage-labs/client/routing/handles';

type Conv = ReturnType<typeof useConversationState>;

export function ConversationTopnav({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  const { isGroup, peerAddr, groupImage, setOverflowOpen, setOverflowAnchor } = c;
  return (
    <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { router.replace('/'); }}>
      <ConvTopnavIdentity
        peerAddr={peerAddr} groupImage={groupImage} channelId={convId} isGroup={isGroup}
        border={border} head={head} title={convTitle(c)}
        onPress={() => {
          if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId } });
          else if (peerAddr) router.push(profileLinkOf(peerAddr));
        }}
      />
      <Pressable
        onPress={(e) => { setOverflowAnchor(menuPointOf(e)); setOverflowOpen(true); }}
        hitSlop={8}
        style={{ paddingHorizontal: 14, justifyContent: 'center' }}
>
        <Icon name="dotsVertical" size={24} color={fg}/>
      </Pressable>
    </ConvTopnavShell>
  );
}

export function ConversationFooter({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { border: rowBg } = usePalette();
  const {
    showJump, setShowJump, scrollToNewest, markAtBottom, activeLine, mentionCandidates,
    replyingTo, setReplyingTo, autoFocusNonce, jumpToMessage, onOptimistic, onSent, consent, markConsentAllowed,
  } = c;
  const requestPending = consent === 'unknown';
  const waiting = useGroupWaiting(convId, c.isGroup);
  const composerShown = !requestPending && !waiting;
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Box>
        {showJump ? (
          <Pressable
            onPress={() => { markAtBottom(); scrollToNewest(); setShowJump(false); }}
            style={{
              position: 'absolute', alignSelf: 'center', bottom: '100%', marginBottom: 8, zIndex: 3,
              width: 36, height: 36, borderRadius: 999,
              backgroundColor: dark ? rowBg : '#000000',
              alignItems: 'center', justifyContent: 'center',
            }}
>
            <Icon name="arrowDown" size={18} color="#ffffff"/>
          </Pressable>
        ) : null}
        {requestPending ? <RequestActionBar convId={convId} dark={dark} onAccepted={markConsentAllowed}/> : null}
        {waiting && !requestPending ? <GroupWaitingNotice/> : null}
        {composerShown ? (
          <MessengerComposer
            dark={dark}
            xmtpLine={activeLine}
            mentionCandidates={mentionCandidates}
            replyingTo={replyingTo ?? undefined}
            autoFocusNonce={autoFocusNonce}
            onClearReply={() => { setReplyingTo(null); }}
            onJumpToReply={jumpToMessage}
            onOptimistic={onOptimistic}
            onSent={onSent}
/>
        ) : null}
        <Box height={insets.bottom} surface="raised"/>
      </Box>
    </KeyboardStickyView>
  );
}

export function ConversationSearchTopnav({ searchInputRef, query, setQuery, onClose }: {
  searchInputRef: React.RefObject<React.ComponentRef<typeof Input> | null>;
  query: string; setQuery: (s: string) => void; onClose: () => void;
}): React.ReactElement {
  const { text: sub, link: head, border } = usePalette();
  const topInset = useSafeAreaInsets().top;
  return (
    <Box style={pinnedTop(2)}>
      <SearchTopnavBar
        ref={searchInputRef}
        border={border}
        query={query}
        setQuery={setQuery}
        onClose={onClose}
        head={head}
        sub={sub}
        placeholder="Search this conversation"
        topInset={topInset}
/>
    </Box>
  );
}

export function ConversationOverlays({ c, convId, onOpenSearch }: {
  c: Conv; convId: string; onOpenSearch: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const {
    overflowOpen, setOverflowOpen, overflowAnchor, isGroup, peerAddr,
    menuFor, setMenuFor, menuAnchor, onReact, setReplyTarget, senderEthOf, setSelectedForCopy,
  } = c;
  const isUnread = (getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0) > 0;
  return (
    <>
      <ChannelMenu
        visible={overflowOpen}
        convId={convId}
        isGroup={isGroup}
        peerAddress={peerAddr}
        isUnread={isUnread}
        isPinned={convId ? isPinned(convId) : false}
        onClose={() => { setOverflowOpen(false); }}
        anchor={overflowAnchor}
        context="view"
        onSearch={onOpenSearch}
        onAfterLeave={result => { capabilities.toast(result === 'left' ? 'Left group' : 'Group hidden'); }}
/>
      <BubbleActionMenu
        target={menuFor}
        anchor={menuAnchor}
        dark={dark}
        onClose={() => { setMenuFor(null); }}
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
          if (menuFor) setSelectedForCopy(menuFor.id);
          setMenuFor(null);
        }}
        onShareLink={() => {
          const path = conversationSharePath(convId, !isGroup ? peerAddr : null);
          if (menuFor) void Share.share({ message: `${shareUrlFor(path)}?m=${menuFor.id}` });
          setMenuFor(null);
        }}
/>
    </>
  );
}
