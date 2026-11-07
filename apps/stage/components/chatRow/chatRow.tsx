import { Vibration } from 'react-native';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { CachedRow } from '../../lib/cachedRows.model';
import type { ChannelFields } from '../../lib/channelFields.model';
import { peerLabel } from '../../lib/peerProfiles';
import { prefetchFeed } from '../../lib/feed/load';
import { channelTimestamp } from '../../lib/format';
import type { MenuPoint } from '../AnchoredMenu.model';
import { rowAvatarAddress, rowTitle } from '../convIdentity';
import { ChannelMenu } from './ChannelMenu';
import { ChannelRowFields } from './ChannelRowFields';
import type { ChannelRow } from './ChannelRow';
import { rowPreviewText } from './chatRow.model';

export function chatPreview(row: CachedRow): string {
  const sender = row.lastSenderAddress;
  return rowPreviewText({
    preview: row.lastPreview,
    dm: !!row.peerAddress,
    fromSelf: row.lastFromSelf,
    senderLabel: sender ? peerLabel(sender) : null,
  });
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

export function chatRowProps(row: CachedRow, shown: { pinned: boolean; fields: ChannelFields; draftText: string }): ChatRowProps {
  const title = rowTitle(row);
  return {
    title: title.text,
    placeholderTitle: title.placeholder,
    avatarUri: row.avatarUri,
    avatarAddress: rowAvatarAddress(row),
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
