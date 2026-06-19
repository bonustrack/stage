/** @file Presentational pieces of the XMTP conversation screen: topnav, composer footer, and the menu/overlay portals. */

import { Share } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../../components/layout';
import type { Input } from '@metro-labs/kit/input';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import type { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getPeerName } from '../../lib/peerProfiles';
import { MessengerComposer } from '../../components/MessengerComposer';
import { Icon } from '@metro-labs/kit/icon';
import { ChannelMenu } from '../../components/ChannelMenu';
import { isPinned } from '../../lib/pins';
import { shortAddress, getCachedRows } from '../../modules/messaging';
import { flash } from '../../lib/toast';
import { HeaderAvatar, BubbleActionMenu, GithubNavButton } from '../../components/xmtp-conv/parts';
import { previewOf } from '../../components/xmtp-conv/feed-helpers';
import { SearchTopnavBar } from '../../components/SearchTopnavBar';
import { TOPNAV_HEIGHT } from '../../components/Topnav';
import { RequestActionBar } from '../../components/RequestActionBar';
import type { useConversationState } from '../../components/xmtp-conv/useConversationState';
import type { EdgeInsets } from 'react-native-safe-area-context';

type Conv = ReturnType<typeof useConversationState>;
type Router = ReturnType<typeof useRouter>;

/** The conversation title text (group name or DM peer name/address). */
function topnavTitle(c: Conv): string {
  if (c.isGroup) return c.groupName === null ? '' : (c.groupName || 'Untitled group');
  return c.peerAddr ? (getPeerName(c.peerAddr) ?? shortAddress(c.peerAddr)) : '';
}

/** Default conversation topnav: back, avatar+title tap target, optional GitHub + overflow. */
export function ConversationTopnav({ c, convId, fg, head, border, insets, router }: {
  c: Conv; convId: string; fg: string; head: string; border: string; insets: EdgeInsets; router: Router;
}): React.ReactElement {
  const { isGroup, github, peerAddr, groupImage, setOverflowOpen } = c;
  return (
    <Row height={TOPNAV_HEIGHT + insets.top} surface="toolbar" padding={{ top: insets.top }} align="stretch" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable
        onPress={() => { router.replace('/'); }}
        style={{ paddingLeft: 14, paddingRight: 8, justifyContent: 'center' }}
>
        <Icon name="arrowLeft" size={22} color={fg}/>
      </Pressable>
      {/** Everything right of the back arrow is one tap target → group/channel detail (or peer profile for a DM); fills full height + width. */}
      <Pressable
        onPress={() => {
          if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId } });
          else if (peerAddr) router.push({ pathname: '/user/[address]', params: { address: peerAddr } });
        }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
>
        <HeaderAvatar peerAddr={peerAddr} groupImage={groupImage} channelId={convId} isGroup={isGroup} border={border}/>
        <Text weight="semibold" size="4xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
          {topnavTitle(c)}
        </Text>
      </Pressable>
      {/** Topnav links (groups only): GitHub issue/PR, then overflow (search lives in the overflow menu now). */}
      {isGroup && github ? <GithubNavButton url={github} color={fg} /> : null}
      <Pressable
        onPress={() => { setOverflowOpen(true); }}
        hitSlop={8}
        style={{ paddingHorizontal: 14, justifyContent: 'center' }}
>
        <Icon name="dotsVertical" size={22} color={fg}/>
      </Pressable>
    </Row>
  );
}

/** The composer footer: jump-to-bottom button, request gate, composer, safe-area strip. */
export function ConversationFooter({ c, convId, dark, rowBg, insets, requestPending, onRequestPending }: {
  c: Conv; convId: string; dark: boolean; rowBg: string; insets: EdgeInsets;
  requestPending: boolean; onRequestPending: (pending: boolean) => void;
}): React.ReactElement {
  const {
    showJump, setShowJump, setListEpoch, markAtBottom, activeLine, mentionCandidates,
    replyingTo, setReplyingTo, autoFocusNonce, jumpToMessage, onOptimistic, onSent,
  } = c;
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Box>
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
            <Icon name="arrowDown" size={18} color="#ffffff"/>
          </Pressable>
        ) : null}
        <RequestActionBar convId={convId} dark={dark} onPending={onRequestPending}/>
        {!requestPending ? (
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

/** Header strip when search is open: the shared expanding SearchTopnavBar. */
export function ConversationSearchTopnav({ searchInputRef, border, head, sub, query, setQuery, onClose, topInset }: {
  searchInputRef: React.RefObject<React.ComponentRef<typeof Input> | null>;
  border: string; head: string; sub: string;
  query: string; setQuery: (s: string) => void; onClose: () => void; topInset: number;
}): React.ReactElement {
  return (
    <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
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

/** Channel-overflow and bubble-action menu portals. */
export function ConversationOverlays({ c, convId, dark, archived, onOpenSearch }: {
  c: Conv; convId: string; dark: boolean; archived: boolean; onOpenSearch: () => void;
}): React.ReactElement {
  const {
    overflowOpen, setOverflowOpen, isGroup, groupName, peerAddr,
    menuFor, setMenuFor, menuAnchor, onReact, setReplyTarget, senderEthOf, setSelectedForCopy,
  } = c;
  const title = isGroup
    ? (groupName == null || groupName === '' ? undefined : groupName)
    : (peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : undefined);
  const isUnread = (getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0) > 0;
  return (
    <>
      <ChannelMenu
        visible={overflowOpen}
        convId={convId}
        title={title}
        isGroup={isGroup}
        peerAddress={peerAddr}
        isUnread={isUnread}
        isPinned={convId ? isPinned(convId) : false}
        isArchived={archived}
        onClose={() => { setOverflowOpen(false); }}
        context="view"
        onSearch={onOpenSearch}
        onAfterLeave={result => { flash(result === 'left' ? 'Left group' : 'Group hidden'); }}
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
          /** Flip this message into a selectable <Text> for partial-copy handles. */
          if (menuFor) setSelectedForCopy(menuFor.id);
          setMenuFor(null);
        }}
        onShareLink={() => {
          /** Shareable permalink to this message. Opens the conversation on the web today; the metro:// universal-link handling is the follow-up. */
          if (menuFor) void Share.share({ message: `https://metro.box/#/xmtp/${convId}?m=${menuFor.id}` });
          setMenuFor(null);
        }}
/>
    </>
  );
}
