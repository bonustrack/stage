
import { memo, useCallback } from 'react';

import { Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { MessagingSetupBanner } from '../system/HistorySync';
import { ChannelRow } from '../ChannelRow';
import { ChannelMenu } from '../ChannelMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Draggable, Shifted, isLifted, type ListDrag } from './listDrag';
import { GroupHeader } from './GroupHeader';
import { isGroupHeader, type HomeListItem } from './groups.model';
import { toggleGroupCollapsed } from '../../lib/channelGroups';
import { resetActiveXmtpStore } from '../../lib/xmtp.client';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { reloadApp } from '../../lib/reloadApp';
import { getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { getDraft } from '../../lib/drafts';
import { conversationLinkOf, isActiveConversationPath } from '../../lib/links';
import type { Row as RowT } from './model';
import type { RowMenu } from './state';
import { channelTimestamp } from '../../lib/format';
import { DANGER } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { Button } from '@stage-labs/kit/react-native/button';
import { rowPreviewText } from './model';
import { rowDataSet } from './rowArrows';
import { isUnnamedChannelRow } from '@stage-labs/client/xmtp/summarizeRow';
import { peerLabel, type ConvTitle } from '../conversation/convTitle';

export function rowTitle(item: RowT): ConvTitle {
  if (item.peerAddress) return { text: getPeerName(item.peerAddress) ?? item.title, placeholder: false };
  return { text: item.title, placeholder: isUnnamedChannelRow(item) };
}

export function rowPreview(item: RowT): string {
  const sender = item.lastSenderAddress;
  return rowPreviewText({
    preview: item.lastPreview,
    dm: !!item.peerAddress,
    fromSelf: item.lastFromSelf,
    senderLabel: sender ? peerLabel(sender) : null,
  });
}

export function rowAvatarAddress(item: RowT, isGroup: boolean): string | null {
  if (item.avatarUri || !item.avatarAddress) return null;
  if (isGroup || isPeerResolved(item.avatarAddress)) return item.avatarAddress;
  return null;
}

export function rowMenuOpener(item: RowT, setRowMenu: (m: RowMenu) => void): (anchor?: MenuPoint) => void {
  return (anchor) => {
    Vibration.vibrate(10);
    setRowMenu({
      convId: item.convId,
      isUnread: item.unreadCount > 0 || item.markedUnread,
      isGroup: !item.peerAddress, peerAddress: item.peerAddress, anchor,
    });
  };
}

export function RowChannelMenu({ menu, isPinned, onClose }: {
  menu: RowMenu | null; isPinned: boolean; onClose: () => void;
}): React.ReactElement | null {
  if (!menu) return null;
  return (
    <ChannelMenu
      visible convId={menu.convId} isGroup={menu.isGroup} peerAddress={menu.peerAddress}
      isUnread={menu.isUnread} isPinned={isPinned} anchor={menu.anchor ?? null}
      onClose={onClose}
    />
  );
}

interface ChannelRowItemProps {
  item: RowT;
  router: { push: (to: { pathname: string; params: { convId: string } }) => void };
  setRowMenu: (m: RowMenu) => void;
  query?: string;
  title: string;
  placeholderTitle: boolean;
  preview: string;
  avatarAddress: string | null;
  pinned: boolean;
  draftText: string;
  active: boolean;
  pinDrag: ListDrag;
  hideAvatar: boolean;
}

function ChannelRowItemBase({
  item, router, setRowMenu, query, title, placeholderTitle, preview, avatarAddress, pinned, draftText, active, pinDrag, hideAvatar,
}: ChannelRowItemProps): React.ReactElement {
  const isGroup = !item.peerAddress;
  const openMenu = rowMenuOpener(item, setRowMenu);
  const dragIndex = pinned ? pinDrag.blockOf.get(item.convId) ?? -1 : -1;
  const row = (
    <ChannelRow
      title={title}
      placeholderTitle={placeholderTitle}
      mark={rowDataSet(item.convId)}
      active={active}
      highlightQuery={query}
      avatarUri={item.avatarUri}
      avatarAddress={avatarAddress}
      hideAvatar={hideAvatar}
      square={isGroup}
      lastPreview={preview}
      timestamp={channelTimestamp(item.lastTs)}
      unreadCount={item.unreadCount}
      markedUnread={item.markedUnread}
      pinned={pinned}
      draftText={draftText}
      labels={isGroup ? item.labels : undefined}
      onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
      onPress={() => { router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
      onLongPress={(anchor) => { if (!isLifted()) openMenu(anchor); }}
    />
  );
  if (dragIndex === -1) return row;
  return <Draggable drag={pinDrag} index={dragIndex} onHold={openMenu}>{row}</Draggable>;
}

function inBlock(
  drag: ListDrag, convId: string, node: React.ReactElement, handle: boolean, onHold?: (anchor: MenuPoint) => void,
): React.ReactElement {
  const index = drag.blockOf.get(convId);
  if (index === undefined) return node;
  if (!handle) return <Shifted drag={drag} index={index}>{node}</Shifted>;
  return <Draggable drag={drag} index={index} onHold={onHold}>{node}</Draggable>;
}

const ChannelRowItem = memo(ChannelRowItemBase);

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: {
    channelProfilesVersion: number; draftsVersion: number;
    pinned: readonly string[]; query?: string; activePath: string; menuConvId?: string; pinDrag: ListDrag;
    sectionDrag: ListDrag; rowDrag: ListDrag; hideAvatar: boolean;
  },
): ({ item }: { item: HomeListItem }) => React.ReactElement {
  const {
    channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, pinDrag, sectionDrag, rowDrag, hideAvatar,
  } = deps;
  return useCallback(({ item }: { item: HomeListItem }): React.ReactElement => {
    if (isGroupHeader(item)) {
      const header = <GroupHeader header={item.header} onToggle={toggleGroupCollapsed}/>;
      return inBlock(sectionDrag, item.convId, inBlock(rowDrag, item.convId, header, false), true);
    }
    const title = rowTitle(item);
    return inBlock(sectionDrag, item.convId, inBlock(rowDrag, item.convId, (
      <ChannelRowItem
        item={item}
        router={router}
        setRowMenu={setRowMenu}
        query={query}
        title={title.text}
        placeholderTitle={title.placeholder}
        preview={rowPreview(item)}
        avatarAddress={rowAvatarAddress(item, !item.peerAddress)}
        pinned={pinned.includes(item.convId)}
        draftText={getDraft(item.convId)}
        active={menuConvId === item.convId || isActiveConversationPath(activePath, item.convId, item.peerAddress)}
        pinDrag={pinDrag}
        hideAvatar={hideAvatar}
      />
    ), true, rowMenuOpener(item, setRowMenu)), false);
  }, [
    router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, pinDrag, sectionDrag,
    rowDrag, hideAvatar,
  ]);
}

const RESET_TITLE = 'Reset local database';
const RESET_MESSAGE = 'Wipes the local XMTP database of this account only. The account and its keys stay, '
  + 'but messages stored on this device are gone and a new device slot is used. An account supports ten.';

function confirmReset(): void {
  void (async (): Promise<void> => {
    if (!await capabilities.confirm({ title: RESET_TITLE, message: RESET_MESSAGE, confirmLabel: 'Reset', destructive: true })) return;
    await resetActiveXmtpStore();
    reloadApp();
  })();
}

export function HomeError({ error, dark, fg }: {
  error: string; dark: boolean; fg: string;
}): React.ReactElement {
  return (
    <Col padding={24} flex={1} align="center" justify="center" surface="surface">
      <Text size="2xs" color={fg} style={{ textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <Button label="Reload" size="lg" pill color="primary" variant="solid" dark={dark}
        style={{ alignSelf: 'center', marginBottom: 12 }} onPress={() => { reloadApp(); }} />
      <Pressable
        onPress={confirmReset}
        style={({ pressed }) => ({
          paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
          backgroundColor: pressed ? '#5c2231' : 'transparent',
          borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
        })}
>
        <Text size="2xs" color={DANGER}>
          {RESET_TITLE}
        </Text>
      </Pressable>
    </Col>
  );
}

export function HomeSpinner({ head }: { head: string }): React.ReactElement {
  return (
    <Col flex={1} surface="surface">
      <MessagingSetupBanner />
      <Col flex={1} align="center" justify="center">
        <Spinner size={28} color={head}/>
      </Col>
    </Col>
  );
}

