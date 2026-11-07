import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { convTitle } from '../../lib/convIdentity';
import { MessengerComposer } from '../composer/MessengerComposer';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ChannelMenu } from '../chatRow/ChannelMenu';
import { menuPointOf } from '../AnchoredMenu';
import { useGroupAccess } from '../../lib/messaging/useConvConsent';
import { xmtpDeleteMessage } from '../../lib/xmtp.messages';
import { ConversationSidebarToggle } from './ConversationSidebarToggle';
import { CallButtons } from '../call/CallButtons';
import { capabilities } from '../../lib/capabilities';
import { BubbleActionMenu, ConvTopnavIdentity, ConvTopnavShell } from './parts';
import { previewOf } from './feed-helpers';
import { canDeleteMessage, isAdminDelete, deleteConfirmOf } from './messageDeletion.model';
import { TopnavSearch } from '../search/TopnavSearch';
import { RequestActionBar } from './RequestActionBar';
import { canApproveConversation, canComposeConversation, composerAccess } from './consent.model';
import type { ComposerSlice, ConvSummary, FeedSlice, MessageMenuSlice, OverflowSlice } from './useConversationState';
import { gatedAsChannel } from './convKind.model';
import { useSafeAreaInsets } from '../layout/safeArea';
import { ComposerDock } from './FooterDock';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { channelProfileLinkOf } from '@stage-labs/client/routing/deepLinks';
import { messageShareUrlOf, profileLinkOf } from '../../lib/links';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { EditChannelModal } from '../channel/EditChannelModal';
import { useChannelEditRights } from '../../lib/messaging/queries';
import { HoverIconButton } from '../hover';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';
import { deleteForEveryone } from '../../lib/ownDeletes';
import { report, reported } from '../../lib/errorPolicy';
import { useAddChatFrameToDashboard, type AddChatFrame } from '../../lib/frames/addToDashboard';
import { frameOf } from '../../lib/frames/frame.model';
import type { HistoryEntry } from '@stage-labs/client/types';
import { Text } from '@stage-labs/kit/react-native/text';
import { CHANNEL_WAITING_NOTICE, OUTSIDE_CHANNEL_NOTICE } from '../channel/accessNotices';
import { homeRoute } from '../tabs/boardHome';
import { Column, Row, pinnedTop, PAGE_GUTTER } from '../layout';
import { type TextField } from '@stage-labs/kit/react-native/text-field';

async function confirmDeleteMessage(messageId: string, asAdmin: boolean): Promise<void> {
  if (!(await capabilities.confirm(deleteConfirmOf(asAdmin)))) return;
  try {
    await deleteForEveryone(messageId, xmtpDeleteMessage);
  } catch (err) {
    report('message.delete', err);
    capabilities.toast('Couldn’t delete the message');
  }
}

function frameAdder(
  add: AddChatFrame | undefined,
  convId: string,
  entry: HistoryEntry | null,
  close: () => void,
): (() => void) | undefined {
  const frame = frameOf(entry ?? undefined);
  if (add === undefined || entry === null || frame === null) return undefined;
  return () => {
    void add(convId, entry.id, frame);
    close();
  };
}

function ChannelAccessNotice({ outside }: { outside: boolean }): React.ReactElement {
  const { border, text: fg } = usePalette();
  return (
    <Column surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Column width={'100%'} padding={{ x: PAGE_GUTTER, top: 14, bottom: 14 }} align="stretch" style={{ alignSelf: 'stretch' }}>
        <Text size="md" color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          {outside ? OUTSIDE_CHANNEL_NOTICE : CHANNEL_WAITING_NOTICE}
        </Text>
      </Column>
    </Column>
  );
}

export function ConversationTopnav({
  conv,
  overflow,
  convId,
}: {
  conv: ConvSummary;
  overflow: OverflowSlice;
  convId: string;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  const { isGroup, peerAddr, groupImage } = conv;
  const back = (): void => {
    router.replace(homeRoute());
  };
  return (
    <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={back}>
      <ConvTopnavIdentity
        peerAddr={peerAddr}
        groupImage={groupImage}
        channelId={convId}
        isGroup={isGroup}
        border={border}
        head={head}
        title={convTitle(conv, 'Untitled channel')}
        onPress={() => {
          if (isGroup) router.push(channelProfileLinkOf(convId));
          else if (peerAddr) router.push(profileLinkOf(peerAddr));
        }}
      />
      <Row align="center" gap={18} padding={{ right: PAGE_GUTTER }}>
        <CallButtons convId={convId} isGroup={isGroup} />
        <ConversationSidebarToggle />
        <HoverIconButton
          icon={IconDotGrid1x3Vertical}
          label="More"
          color={fg}
          placement="below"
          role="button"
          onPress={(e) => {
            overflow.setAnchor(menuPointOf(e));
            overflow.setOpen(true);
          }}
        />
      </Row>
    </ConvTopnavShell>
  );
}

export function ConversationFooter({
  conv,
  composer,
  scroll,
  convId,
}: {
  conv: ConvSummary;
  composer: ComposerSlice;
  scroll: FeedSlice['scroll'];
  convId: string;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border: rowBg } = usePalette();
  const { showJump, setShowJump, scrollToNewest, markAtBottom, jumpToMessage } = scroll;
  const {
    line,
    mentionCandidates,
    replyingTo,
    setReplyingTo,
    autoFocusNonce,
    onOptimistic,
    onSent,
    consent,
    consentKnown,
    markConsentAllowed,
  } = composer;
  const isGroup = gatedAsChannel(conv.kind);
  const access = useGroupAccess(convId, isGroup);
  const requestPending = canApproveConversation(consent, isGroup, access);
  const composerShown = consentKnown && canComposeConversation(consent, isGroup, composerAccess(access, consent));
  return (
    <ComposerDock>
      {showJump ? (
        <Pressable
          onPress={() => {
            markAtBottom();
            scrollToNewest();
            setShowJump(false);
          }}
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: '100%',
            marginBottom: 8,
            zIndex: 3,
            width: 36,
            height: 36,
            borderRadius: 999,
            backgroundColor: dark ? rowBg : '#000000',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph icon={IconArrowDown} size={18} color="#ffffff" />
        </Pressable>
      ) : null}
      {requestPending ? <RequestActionBar convId={convId} dark={dark} onAccepted={markConsentAllowed} /> : null}
      {access === 'waiting' || access === 'outside' ? <ChannelAccessNotice outside={access === 'outside'} /> : null}
      {composerShown ? (
        <MessengerComposer
          xmtpLine={line}
          mentionCandidates={mentionCandidates}
          suggestContacts={conv.kind === 'dm'}
          replyingTo={replyingTo ?? undefined}
          autoFocusNonce={autoFocusNonce}
          onClearReply={() => {
            setReplyingTo(null);
          }}
          onRestoreReply={() => {
            setReplyingTo((current) => current ?? replyingTo);
          }}
          onJumpToReply={jumpToMessage}
          onOptimistic={onOptimistic}
          onSent={onSent}
        />
      ) : null}
    </ComposerDock>
  );
}

export function ConversationSearchTopnav({
  searchInputRef,
  query,
  setQuery,
  onClose,
}: {
  searchInputRef: React.RefObject<React.ComponentRef<typeof TextField> | null>;
  query: string;
  setQuery: (s: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const topInset = useSafeAreaInsets().top;
  return (
    <Column style={pinnedTop(2)}>
      <TopnavSearch
        ref={searchInputRef}
        query={query}
        setQuery={setQuery}
        onClose={onClose}
        placeholder="Search this conversation"
        topInset={topInset}
      />
    </Column>
  );
}

function ConversationMessageMenu({
  conv,
  menu,
  convId,
}: {
  conv: ConvSummary;
  menu: MessageMenuSlice;
  convId: string;
}): React.ReactElement {
  const { isGroup, peerAddr } = conv;
  const {
    target: menuFor,
    setTarget: setMenuFor,
    anchor: menuAnchor,
    onReact,
    setReplyTarget,
    senderEthOf,
    setSelectedForCopy,
    myUri,
    deletedIds,
    isSuperAdmin,
  } = menu;
  const addFrame = useAddChatFrameToDashboard();
  return (
    <BubbleActionMenu
      target={menuFor}
      anchor={menuAnchor}
      canDelete={canDeleteMessage(menuFor, { myUri, deleted: deletedIds, superAdmin: isSuperAdmin })}
      onClose={() => {
        setMenuFor(null);
      }}
      onReact={(emoji) => {
        if (menuFor) onReact(menuFor.id, emoji);
        setMenuFor(null);
      }}
      onReply={() => {
        if (menuFor) setReplyTarget(menuFor.id, previewOf(menuFor), senderEthOf(menuFor.from));
        setMenuFor(null);
      }}
      onCopy={() => {
        if (menuFor?.text) void Clipboard.setStringAsync(menuFor.text).catch(reported('message.copy'));
        setMenuFor(null);
      }}
      onSelect={() => {
        if (menuFor) setSelectedForCopy(menuFor.id);
        setMenuFor(null);
      }}
      onAddToDashboard={frameAdder(addFrame, convId, menuFor, () => {
        setMenuFor(null);
      })}
      onShareLink={() => {
        if (menuFor) capabilities.shareLink(messageShareUrlOf(convId, !isGroup ? peerAddr : null, menuFor.id));
        setMenuFor(null);
      }}
      onDelete={() => {
        if (menuFor) void confirmDeleteMessage(menuFor.id, isAdminDelete(menuFor, myUri));
        setMenuFor(null);
      }}
    />
  );
}

export function ConversationOverlays({
  conv,
  overflow,
  messageMenu,
  convId,
  onOpenSearch,
}: {
  conv: ConvSummary;
  overflow: OverflowSlice;
  messageMenu: MessageMenuSlice;
  convId: string;
  onOpenSearch: () => void;
}): React.ReactElement {
  const { open: overflowOpen, setOpen: setOverflowOpen, anchor: overflowAnchor } = overflow;
  const { isGroup } = conv;
  const rights = useChannelEditRights(convId, isGroup);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = isGroup && canEditGroup(rights);
  return (
    <>
      <ChannelMenu
        visible={overflowOpen}
        convId={convId}
        onClose={() => {
          setOverflowOpen(false);
        }}
        anchor={overflowAnchor}
        from="chat"
        onSearch={onOpenSearch}
        onEdit={
          canEdit
            ? () => {
                setEditOpen(true);
              }
            : undefined
        }
      />
      {canEdit ? (
        <EditChannelModal
          visible={editOpen}
          onClose={() => {
            setEditOpen(false);
          }}
          convId={convId}
          name={conv.groupName}
          description={conv.groupDescription}
          imageUrl={conv.groupImage}
          rights={rights}
          labels={conv.groupLabels}
        />
      ) : null}
      <ConversationMessageMenu conv={conv} menu={messageMenu} convId={convId} />
    </>
  );
}
