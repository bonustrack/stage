import { useRouter } from 'expo-router';
import { MenuItems, type MenuActions } from '../MenuRows';
import { channelMenuItems, type ChannelMenuId } from './ChannelMenu.model';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { markConvRead, markConvUnread, subscribeCachedRows } from '../../lib/channelsCache';
import { togglePin, usePinnedOrder } from '../../lib/sync/pins';
import { channelProfileLinkOf, profileLinkOf } from '../../lib/links';
import { openAddMembers } from '../../lib/memberList';
import { useDeveloperMode } from '../../lib/developerMode';
import { useConvRow } from '../../lib/messaging/queries';
import { isGroupRow } from '../../lib/messaging/convRow.model';
import { homeRowOf } from '../../lib/messaging/homeRows';
import { useStoreValue } from '../../lib/storeCore';
import { checkChannelSync, deleteChat, leaveChannel, type ChannelActionFrom } from '../channel/channelActions';
import { isUnreadRow } from './chatRow.model';
import { reported } from '../../lib/errorPolicy';

interface ChannelMenuProps {
  convId: string;
  visible: boolean;
  onClose: () => void;
  anchor?: MenuPoint | null;
  from?: ChannelActionFrom;
  onSearch?: () => void;
  onEdit?: () => void;
}

function useIsUnread(convId: string): boolean {
  return useStoreValue(subscribeCachedRows, () => {
    const row = homeRowOf(convId);
    return row !== undefined && isUnreadRow(row);
  });
}

export function ChannelMenu({ convId, visible, onClose, anchor, from = 'list', onSearch, onEdit }: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const row = useConvRow(convId);
  const isGroup = isGroupRow(row);
  const peerAddress = row?.peerAddress ?? null;
  const isUnread = useIsUnread(convId);
  const isPinned = usePinnedOrder().includes(convId);
  const developerMode = useDeveloperMode();
  const items = channelMenuItems(
    { isGroup, hasPeer: !!peerAddress, isUnread, isPinned },
    { search: !!onSearch, edit: !!onEdit, developerMode },
  );
  const actions: MenuActions<ChannelMenuId> = {
    search: { opensModal: true, run: () => onSearch?.() },
    'add-members': {
      opensModal: true,
      run: () => {
        openAddMembers(convId);
      },
    },
    'toggle-read': () => {
      void (isUnread ? markConvRead(convId) : markConvUnread(convId)).catch(reported('chatRow.read'));
    },
    'toggle-pin': () => {
      void togglePin(convId).catch(reported('chatRow.pin'));
    },
    info: () => {
      if (isGroup) router.push(channelProfileLinkOf(convId));
      else if (peerAddress) router.push(profileLinkOf(peerAddress));
    },
    sync: () => {
      void checkChannelSync(convId);
    },
    edit: { opensModal: true, run: () => onEdit?.() },
    leave: () => {
      void leaveChannel(convId, from, router);
    },
    delete: () => {
      if (peerAddress) deleteChat(convId, peerAddress, from, router);
    },
  };
  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      <MenuItems items={items} actions={actions} onClose={onClose} />
    </AnchoredMenu>
  );
}
