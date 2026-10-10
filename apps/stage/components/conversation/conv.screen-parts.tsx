import { useState } from 'react';
import { Share } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Row, pinnedTop, PAGE_GUTTER, Col } from '../layout';
import type { Input } from '@stage-labs/kit/react-native/input';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { convTitle } from './convTitle';
import { MessengerComposer } from '../composer/MessengerComposer';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ChannelMenu } from '../ChannelMenu';
import { menuPointOf } from '../AnchoredMenu';
import { isPinned } from '../../lib/pins';
import { getCachedRows } from '../../lib/channelsCache';
import { useGroupAccess } from '../../modules/messaging/useConvConsent';
import { xmtpDeleteMessage } from '../../lib/xmtp.messages';
import { ConversationSidebarToggle } from './ConversationSidebarToggle';
import { CallButtons } from '../call/CallButtons';
import { capabilities } from '../../lib/capabilities';
import { BubbleActionMenu, ConvTopnavIdentity, ConvTopnavShell } from './parts';
import { previewOf } from './feed-helpers';
import { canDeleteMessage, isAdminDelete, deleteConfirmOf } from './messageDeletion.model';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { RequestActionBar } from '../RequestActionBar';
import { canApproveConversation, canComposeConversation } from './consent.model';
import type { useConversationState } from './useConversationState';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { ComposerDock } from './FooterDock';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { channelProfileLinkOf, conversationSharePath, profileLinkOf } from '../../lib/links';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { EditChannelModal } from '../channel/EditChannelModal';
import { useChannelEditRights } from '../channel/channel.detail';
import { shareUrlFor } from '@stage-labs/client/routing/handles';
import { HoverIconButton } from '../hover';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';
import { markOwnDelete, unmarkOwnDelete } from '../../lib/ownDeletes';
import { report } from '../../lib/errorPolicy';
import { addFrameToDashboard, addLiveToDashboard } from '../../lib/dashboard';
import { newNodeKey, nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import { FRAME_ADD_TOASTS } from '../dashboard/dashboard.model';
import { frameIsFullWidth, frameOf } from '../frame/frame.model';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { HistoryEntry } from '@stage-labs/client/types';
import { Text } from '@stage-labs/kit/react-native/text';
import { CHANNEL_WAITING_NOTICE, OUTSIDE_CHANNEL_NOTICE } from '@stage-labs/client/xmtp/clientErrors';
import { homeRoute } from '../tabs/boardHome';

async function confirmDeleteMessage(messageId: string, asAdmin: boolean): Promise<void> {
  if (!await capabilities.confirm(deleteConfirmOf(asAdmin))) return;
  await markOwnDelete(messageId);
  try {
    await xmtpDeleteMessage(messageId);
  } catch (err) {
    report('message.delete', err);
    await unmarkOwnDelete(messageId);
    capabilities.toast('Couldn’t delete the message');
  }
}

async function addFrameWidget(convId: string, messageId: string, frame: FrameContent): Promise<void> {
  const width = frameIsFullWidth(frame) ? 'full' : 'half';
  const node = frame.source === undefined ? null : nodeUrlOf(frame.source.url);
  try {
    const outcome = node?.ok === true
      ? (await addLiveToDashboard({ url: node.url, key: newNodeKey() }, width)).outcome
      : await addFrameToDashboard({ conversationId: convId, messageId }, width);
    capabilities.toast(FRAME_ADD_TOASTS[outcome]);
  } catch (err) {
    report('dashboard.addFrame', err);
    capabilities.toast('Could not add it to your dashboard');
  }
}

function frameAdder(convId: string, entry: HistoryEntry | null, close: () => void): (() => void) | undefined {
  const frame = frameOf(entry ?? undefined);
  if (entry === null || frame === null) return undefined;
  return () => {
    void addFrameWidget(convId, entry.id, frame);
    close();
  };
}

function ChannelAccessNotice({ outside }: { outside: boolean }): React.ReactElement {
  const { border, text: fg } = usePalette();
  return (
    <Box surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Col width={'100%'} padding={{ x: PAGE_GUTTER, top: 14, bottom: 14 }} align="stretch" style={{ alignSelf: 'stretch' }}>
        <Text size="md" color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          {outside ? OUTSIDE_CHANNEL_NOTICE : CHANNEL_WAITING_NOTICE}
        </Text>
      </Col>
    </Box>
  );
}

type Conv = ReturnType<typeof useConversationState>;

export function ConversationTopnav({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  const { isGroup, peerAddr, groupImage, setOverflowOpen, setOverflowAnchor } = c;
  const back = (): void => { router.replace(homeRoute()); };
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
        <HoverIconButton
          icon={IconDotGrid1x3Vertical} label="More" color={fg} placement="below" role="button"
          onPress={(e) => { setOverflowAnchor(menuPointOf(e)); setOverflowOpen(true); }}
        />
      </Row>
    </ConvTopnavShell>
  );
}

export function ConversationFooter({ c, convId }: { c: Conv; convId: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border: rowBg } = usePalette();
  const {
    showJump, setShowJump, scrollToNewest, markAtBottom, activeLine, mentionCandidates,
    replyingTo, setReplyingTo, autoFocusNonce, jumpToMessage, onOptimistic, onSent, consent, consentKnown, markConsentAllowed,
  } = c;
  const isGroup = c.peerAddr === null;
  const access = useGroupAccess(convId, isGroup);
  const requestPending = canApproveConversation(consent, isGroup, access);
  const composerShown = consentKnown && canComposeConversation(consent, isGroup, access);
  return (
    <ComposerDock>
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
      {access === 'waiting' || access === 'outside' ? <ChannelAccessNotice outside={access === 'outside'}/> : null}
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
    </ComposerDock>
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
        onAddToDashboard={frameAdder(convId, menuFor, () => { setMenuFor(null); })}
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
