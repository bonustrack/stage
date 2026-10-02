
import { useState } from 'react';
import { Share } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Row, pinnedTop, PAGE_GUTTER } from '../layout';
import type { Input } from '@stage-labs/kit/react-native/input';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { usePathname, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { convTitle } from './convTitle';
import { MessengerComposer } from '../composer/MessengerComposer';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ChannelMenu } from '../ChannelMenu';
import { menuPointOf } from '../AnchoredMenu';
import { isPinned } from '../../lib/pins';
import { getCachedRows, useGroupAccess } from '../../modules/messaging';
import { ChannelAccessNotice } from './ChannelAccessNotice';
import { ConversationSidebarToggle } from './ConversationSidebarToggle';
import { CallButtons } from '../call/CallButtons';
import { HoverTooltip } from '../HoverTooltip';
import { capabilities } from '../../lib/capabilities';
import { boardPanelConvId } from '../tabs/splitRoutes';
import { BubbleActionMenu, ConvTopnavIdentity, ConvTopnavShell } from './parts';
import { previewOf } from './feed-helpers';
import { canDeleteMessage, isAdminDelete } from './messageDeletion.model';
import { confirmDeleteMessage } from './deleteMessage';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { RequestActionBar } from '../RequestActionBar';
import type { useConversationState } from './useConversationState';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { conversationSharePath, profileLinkOf } from '../../lib/links';
import { channelProfileLinkOf } from '../../lib/conversationLink';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { EditChannelModal } from '../channel/EditChannelModal';
import { useChannelEditRights } from '../channel/channel.detail';
import { shareUrlFor } from '@stage-labs/client/routing/handles';
import { useHover } from '../hover';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';

type Conv = ReturnType<typeof useConversationState>;

export function ConversationTopnav({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const router = useRouter();
  const onBoard = boardPanelConvId(usePathname()) !== null;
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  const { isGroup, peerAddr, groupImage, setOverflowOpen, setOverflowAnchor } = c;
  const more = useHover();
  const back = (): void => { if (onBoard) capabilities.backTo('/board'); else router.replace('/'); };
  return (
    <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={back}>
      <ConvTopnavIdentity
        peerAddr={peerAddr} groupImage={groupImage} channelId={convId} isGroup={isGroup}
        border={border} head={head} title={convTitle(c)}
        onPress={() => {
          if (isGroup) router.push(channelProfileLinkOf(convId));
          else if (peerAddr) router.push(profileLinkOf(peerAddr));
        }}
      />
      <Row align="center" gap={18} padding={{ right: PAGE_GUTTER }}>
        <CallButtons convId={convId} isGroup={isGroup}/>
        <ConversationSidebarToggle/>
        <HoverTooltip label="More" placement="below">
          <Pressable
            onPress={(e) => { setOverflowAnchor(menuPointOf(e)); setOverflowOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="More"
            hitSlop={8}
            {...more.hoverProps}
          >
            <Glyph icon={IconDotGrid1x3Vertical} size={24} color={more.hovered ? head : fg}/>
          </Pressable>
        </HoverTooltip>
      </Row>
    </ConvTopnavShell>
  );
}

export function ConversationFooter({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { border: rowBg } = usePalette();
  const {
    showJump, setShowJump, scrollToNewest, markAtBottom, activeLine, mentionCandidates,
    replyingTo, setReplyingTo, autoFocusNonce, jumpToMessage, onOptimistic, onSent, consent, consentKnown, markConsentAllowed,
  } = c;
  const requestPending = consent === 'unknown';
  const access = useGroupAccess(convId, c.isGroup);
  const composerShown = consentKnown && access === 'member';
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
            <Glyph icon={IconArrowDown} size={18} color="#ffffff"/>
          </Pressable>
        ) : null}
        {requestPending ? <RequestActionBar convId={convId} dark={dark} onAccepted={markConsentAllowed}/> : null}
        {access !== 'member' && !requestPending ? <ChannelAccessNotice outside={access === 'outside'}/> : null}
        {composerShown ? (
          <MessengerComposer
            dark={dark}
            xmtpLine={activeLine}
            mentionCandidates={mentionCandidates}
            suggestContacts={c.peerAddr !== null}
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
  const {
    overflowOpen, setOverflowOpen, overflowAnchor, isGroup, peerAddr,
    menuFor, setMenuFor, menuAnchor, onReact, setReplyTarget, senderEthOf, setSelectedForCopy, myUri, deletedIds,
    isSuperAdmin,
  } = c;
  const isUnread = (getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0) > 0;
  const rights = useChannelEditRights(convId, isGroup);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = isGroup && canEditGroup(rights);
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
        onEdit={canEdit ? () => { setEditOpen(true); } : undefined}
        onAfterLeave={result => { capabilities.toast(result === 'left' ? 'Left channel' : 'Channel hidden'); }}
/>
      {canEdit ? (
        <EditChannelModal
          visible={editOpen}
          onClose={() => { setEditOpen(false); }}
          convId={convId} name={c.groupName} description={c.groupDescription} imageUrl={c.groupImage} rights={rights}
          labels={c.groupLabels}
        />
      ) : null}
      <BubbleActionMenu
        target={menuFor}
        anchor={menuAnchor}
        canDelete={canDeleteMessage(menuFor, { myUri, deleted: deletedIds, superAdmin: isSuperAdmin })}
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
        onDelete={() => {
          if (menuFor) void confirmDeleteMessage(menuFor.id, isAdminDelete(menuFor, myUri));
          setMenuFor(null);
        }}
/>
    </>
  );
}
