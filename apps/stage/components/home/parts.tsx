import { memo, useCallback } from 'react';
import { Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { MessagingSetupBanner } from '../system/HistorySync';
import { ChannelRow } from '../ChannelRow';
import { ChannelRowFields } from '../ChannelRowFields';
import type { ChannelFields } from './fields.model';
import { ChannelMenu } from '../ChannelMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Draggable, MeasuredDragRow, Shifted, type ListDrag, type ListDragMeasurements } from './listDrag';
import { isLifted } from '../dragLift';
import { GroupHeader, useGroupHover } from './GroupHeader';
import { isGroupHeader, type HomeListItem } from './groups.model';
import { toggleGroupCollapsed } from '../../lib/channelGroups';
import { resetActiveXmtpStore } from '../../lib/xmtp.client';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { reloadApp } from '../../lib/reloadApp';
import { getPeerName, isPeerResolved, peerLabel } from '../../lib/peerProfiles';
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
import { type ConvTitle } from '../conversation/convTitle';
import { Column } from '../layout';

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

export function rowAvatarAddress(item: RowT): string | null {
  if (item.avatarUri || !item.avatarAddress) return null;
  return !item.peerAddress || isPeerResolved(item.avatarAddress) ? item.avatarAddress : null;
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
  current: boolean;
  pinDrag: ListDrag;
  hideAvatar: boolean;
  fields: ChannelFields;
}

function ChannelRowItemBase({
  item, router, setRowMenu, query, title, placeholderTitle, preview, avatarAddress, pinned, draftText, active, current, pinDrag, hideAvatar, fields,
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
      showPreview={fields.lastMessage}
      timestamp={channelTimestamp(item.lastTs)}
      unreadCount={item.unreadCount}
      markedUnread={item.markedUnread}
      pinned={pinned}
      draftText={draftText}
      fields={<ChannelRowFields data={item} fields={fields}/>}
      onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
      onPress={() => { if (!current) router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
      onLongPress={(anchor) => { if (!isLifted()) openMenu(anchor); }}
    />
  );
  if (dragIndex === -1) return row;
  return <Draggable drag={pinDrag} index={dragIndex} onHold={openMenu}>{row}</Draggable>;
}

function inBlock(
  drag: ListDrag, convId: string, node: React.ReactElement, handle: boolean, onHold?: (anchor: MenuPoint) => void, shift = true,
): React.ReactElement {
  const index = drag.blockOf.get(convId);
  if (index === undefined) return node;
  if (!handle) return <Shifted drag={drag} index={index}>{node}</Shifted>;
  return <Draggable drag={drag} index={index} onHold={onHold} shift={shift}>{node}</Draggable>;
}

const ChannelRowItem = memo(ChannelRowItemBase);

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: {
    channelProfilesVersion: number; draftsVersion: number;
    pinned: readonly string[]; query?: string; activePath: string; menuConvId?: string; pinDrag: ListDrag;
    sectionDrag: ListDrag; rowDrag: ListDrag; hideAvatar: boolean; fields: ChannelFields; dragMeasurements: ListDragMeasurements;
    items: readonly HomeListItem[];
  },
): ({ item }: { item: HomeListItem }) => React.ReactElement {
  const {
    channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, pinDrag, sectionDrag, rowDrag, hideAvatar, fields, dragMeasurements,
  } = deps;
  const { hoveredGroup, wrapItem } = useGroupHover(deps.items);
  return useCallback(({ item }: { item: HomeListItem }): React.ReactElement => {
    if (isGroupHeader(item)) {
      const header = <GroupHeader header={item.header} onToggle={toggleGroupCollapsed} sectionHovered={hoveredGroup === item.header.key}
        wrapToggle={node => inBlock(sectionDrag, item.convId, node, true, undefined, false)}/>;
      return wrapItem(item, inBlock(sectionDrag, item.convId, inBlock(rowDrag, item.convId, header, false), false));
    }
    const title = rowTitle(item);
    const current = isActiveConversationPath(activePath, item.convId, item.peerAddress);
    return wrapItem(item, inBlock(sectionDrag, item.convId, inBlock(rowDrag, item.convId, (
      <MeasuredDragRow item={item} measure={dragMeasurements.measure}>
        <ChannelRowItem
          item={item}
          router={router}
          setRowMenu={setRowMenu}
          query={query}
          title={title.text}
          placeholderTitle={title.placeholder}
          preview={rowPreview(item)}
          avatarAddress={rowAvatarAddress(item)}
          pinned={pinned.includes(item.convId)}
          draftText={getDraft(item.convId)}
          active={menuConvId === item.convId || current}
          current={current}
          pinDrag={pinDrag}
          hideAvatar={hideAvatar}
          fields={fields}
        />
      </MeasuredDragRow>
    ), true, rowMenuOpener(item, setRowMenu)), false));
  }, [
    router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, pinDrag, sectionDrag,
    rowDrag, hideAvatar, fields, dragMeasurements, hoveredGroup, wrapItem,
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
    <Column padding={24} weight={1} align="center" justify="center" surface="surface">
      <Text size="xs" color={fg} style={{ textAlign: 'center', marginBottom: 16 }}>{error}</Text>
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
        <Text size="xs" color={DANGER}>
          {RESET_TITLE}
        </Text>
      </Pressable>
    </Column>
  );
}

export function HomeSpinner({ head }: { head: string }): React.ReactElement {
  return (
    <Column weight={1} surface="surface">
      <MessagingSetupBanner />
      <Column weight={1} align="center" justify="center">
        <Spinner size={28} color={head}/>
      </Column>
    </Column>
  );
}

