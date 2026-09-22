
import { memo, useCallback } from 'react';

import { Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { Spinner } from '../Spinner';
import { MessagingSetupBanner } from '../system/HistorySync';
import { ChannelRow } from '../ChannelRow';
import { PinnedDraggable, type PinDrag } from './pinDrag';
import { resetActiveXmtpStore, shortAddress, prefetchFeed, lineOfConv } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';
import { getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { getDraft } from '../../lib/drafts';
import { conversationLinkOf, isActiveConversationPathFor } from '../../lib/links';
import type { Row as RowT } from './helpers';
import type { RowMenu } from './state';
import { channelTimestamp } from '../../lib/format';
import { DANGER } from '../../lib/theme';
import { rowPreviewText } from './model';

function rowTitle(item: RowT): string {
  return item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
}

function rowPreview(item: RowT): string {
  const sender = item.lastSenderAddress;
  return rowPreviewText({
    preview: item.lastPreview,
    dm: !!item.peerAddress,
    fromSelf: item.lastFromSelf,
    senderLabel: sender ? getPeerName(sender) ?? shortAddress(sender) : null,
  });
}

function rowAvatarAddress(item: RowT, isGroup: boolean): string | null {
  if (item.avatarUri || !item.avatarAddress) return null;
  if (isGroup || isPeerResolved(item.avatarAddress)) return item.avatarAddress;
  return null;
}

interface ChannelRowItemProps {
  item: RowT;
  router: { push: (to: { pathname: string; params: { convId: string } }) => void };
  setRowMenu: (m: RowMenu) => void;
  query?: string;
  title: string;
  preview: string;
  avatarAddress: string | null;
  pinned: boolean;
  draftText: string;
  active: boolean;
  pinDrag: PinDrag;
}

function ChannelRowItemBase({
  item, router, setRowMenu, query, title, preview, avatarAddress, pinned, draftText, active, pinDrag,
}: ChannelRowItemProps): React.ReactElement {
  const isGroup = !item.peerAddress;
  const openMenu = (anchor?: { x: number; y: number }): void => {
    Vibration.vibrate(10);
    setRowMenu({
      convId: item.convId,
      isUnread: item.unreadCount > 0 || item.markedUnread,
      isGroup, peerAddress: item.peerAddress, anchor,
    });
  };
  const dragIndex = pinned ? pinDrag.visible.indexOf(item.convId) : -1;
  const row = (
    <ChannelRow
      title={title}
      active={active}
      highlightQuery={query}
      avatarUri={item.avatarUri}
      avatarAddress={avatarAddress}
      square={isGroup}
      lastPreview={preview}
      timestamp={channelTimestamp(item.lastTs)}
      unreadCount={item.unreadCount}
      markedUnread={item.markedUnread}
      pinned={pinned}
      hasDraft={draftText.trim().length > 0}
      draftText={draftText}
      labels={isGroup ? item.labels : undefined}
      onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
      onPress={() => { router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
      onLongPress={openMenu}
    />
  );
  if (dragIndex === -1) return row;
  return <PinnedDraggable drag={pinDrag} index={dragIndex} onHold={openMenu}>{row}</PinnedDraggable>;
}

const ChannelRowItem = memo(ChannelRowItemBase);

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: {
    channelProfilesVersion: number; draftsVersion: number;
    pinned: readonly string[]; query?: string; activePath: string; pinDrag: PinDrag;
  },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query, activePath, pinDrag } = deps;
  return useCallback(({ item }: { item: RowT }): React.ReactElement => (
    <ChannelRowItem
      item={item}
      router={router}
      setRowMenu={setRowMenu}
      query={query}
      title={rowTitle(item)}
      preview={rowPreview(item)}
      avatarAddress={rowAvatarAddress(item, !item.peerAddress)}
      pinned={pinned.includes(item.convId)}
      draftText={getDraft(item.convId)}
      active={isActiveConversationPathFor(activePath, item.convId, item.peerAddress)}
      pinDrag={pinDrag}
    />
  ), [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query, activePath, pinDrag]);
}

export function HomeError({ error, dark, fg }: {
  error: string; dark: boolean; fg: string;
}): React.ReactElement {
  return (
    <Col padding={24} flex={1} align="center" justify="center" surface="surface">
      <Text size="md" color={fg} style={{ textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <Pressable
        onPress={() => {
          void (async (): Promise<void> => {
            await resetActiveXmtpStore();
            reloadApp();
          })();
        }}
        style={({ pressed }) => ({
          paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
          backgroundColor: pressed ? '#5c2231' : 'transparent',
          borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
        })}
>
        <Text size="md" color={DANGER}>
          Reset XMTP database
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

