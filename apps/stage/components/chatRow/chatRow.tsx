import { Vibration } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { isUnnamedChannelRow } from '@stage-labs/client/xmtp/summarizeRow';
import type { HomeRow } from '../../lib/messaging/homeRows';
import type { ChannelFields } from '../../lib/channelFields.model';
import { getPeerName, isPeerResolved, peerLabel, usePeerProfiles } from '../../lib/peerProfiles';
import { storageChatOf } from '../../lib/storageIndex';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { prefetchFeed } from '../../lib/messaging/feedQuery';
import { channelTimestamp } from '../../lib/format';
import type { MenuPoint } from '../AnchoredMenu.model';
import type { ConvTitle } from '../conversation/convTitle';
import { ChannelMenu } from './ChannelMenu';
import { ChannelRowFields } from './ChannelRowFields';
import type { ChannelRow } from './ChannelRow';
import { chatLabelOf, rowPreviewText } from './chatRow.model';

export function chatTitle(row: HomeRow): ConvTitle {
  if (row.peerAddress) return { text: getPeerName(row.peerAddress) ?? row.title, placeholder: false };
  return { text: row.title, placeholder: isUnnamedChannelRow(row) };
}

export function chatPreview(row: HomeRow): string {
  const sender = row.lastSenderAddress;
  return rowPreviewText({
    preview: row.lastPreview,
    dm: !!row.peerAddress,
    fromSelf: row.lastFromSelf,
    senderLabel: sender ? peerLabel(sender) : null,
  });
}

export function chatAvatarAddress(row: HomeRow): string | null {
  if (row.avatarUri || !row.avatarAddress) return null;
  return !row.peerAddress || isPeerResolved(row.avatarAddress) ? row.avatarAddress : null;
}

type ChatRowProps = Pick<
  React.ComponentProps<typeof ChannelRow>,
  | 'title'
  | 'placeholderTitle'
  | 'avatarUri'
  | 'avatarAddress'
  | 'square'
  | 'hideAvatar'
  | 'lastPreview'
  | 'showPreview'
  | 'timestamp'
  | 'unreadCount'
  | 'markedUnread'
  | 'pinned'
  | 'draftText'
  | 'fields'
  | 'onPressIn'
>;

export function chatRowProps(row: HomeRow, shown: { pinned: boolean; fields: ChannelFields; draftText: string }): ChatRowProps {
  const title = chatTitle(row);
  return {
    title: title.text,
    placeholderTitle: title.placeholder,
    avatarUri: row.avatarUri,
    avatarAddress: chatAvatarAddress(row),
    square: !row.peerAddress,
    hideAvatar: !shown.fields.avatar,
    lastPreview: chatPreview(row),
    showPreview: shown.fields.lastMessage,
    timestamp: channelTimestamp(row.lastTs),
    unreadCount: row.unreadCount,
    markedUnread: row.markedUnread,
    pinned: shown.pinned,
    draftText: shown.draftText,
    fields: <ChannelRowFields data={row} fields={shown.fields} />,
    onPressIn: () => {
      prefetchFeed(lineOfConv(row.convId));
    },
  };
}

export interface RowMenu {
  convId: string;
  anchor?: MenuPoint;
}

export function rowMenuOpener(convId: string, setRowMenu: (m: RowMenu) => void): (anchor?: MenuPoint) => void {
  return (anchor) => {
    Vibration.vibrate(10);
    setRowMenu({ convId, anchor });
  };
}

export function RowChannelMenu({ menu, onClose }: { menu: RowMenu | null; onClose: () => void }): React.ReactElement | null {
  if (!menu) return null;
  return <ChannelMenu visible convId={menu.convId} anchor={menu.anchor ?? null} onClose={onClose} />;
}

const CHAT_STALE_MS = 5 * 60_000;

interface StoredChat {
  peerAddress: string | null;
  label: string;
}

export function useStoredChat(convId: string, recheckMs?: number): StoredChat | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['storageChat', epoch, convId],
    queryFn: () => storageChatOf(convId),
    staleTime: CHAT_STALE_MS,
    retry: false,
    refetchInterval: recheckMs === undefined ? undefined : (query) => (query.state.data ? false : recheckMs),
  });
  const peer = data?.peerAddress ?? null;
  usePeerProfiles([peer]);
  if (data === null || data === undefined) return null;
  return { peerAddress: peer, label: chatLabelOf(data, peerLabel) };
}
