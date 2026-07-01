
import { Alert } from 'react-native';

import { useRouter } from 'expo-router';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers, WidgetRoot } from '@stage-labs/kit/kit';
import { Box } from './layout';
import type { MenuSheetItem } from '@stage-labs/views';
import { menuSheet, MENU_ITEM_PRESS } from '@stage-labs/views';
import { AppModal } from './AppModal';
import { markConvRead, markConvUnread } from '../modules/messaging';
import { togglePin } from '../lib/pins';
import { toggleArchived } from '../lib/archived';
import { leaveGroupConv, lineOfConv } from '../modules/messaging';

export interface ChannelMenuProps {
  convId: string;
  title?: string | null;
  isGroup: boolean;
  peerAddress?: string | null;
  isUnread: boolean;
  isPinned: boolean;
  isArchived: boolean;
  visible: boolean;
  onClose: () => void;
  context?: 'list' | 'view';
  onAfterLeave?: (result: 'left' | 'hidden') => void;
  onAfterArchive?: (archived: boolean) => void;
  onSearch?: () => void;
}

function confirmLeaveGroup(
  convId: string, context: 'list' | 'view',
  router: ReturnType<typeof useRouter>,
  onClose: () => void, onAfterLeave?: (result: 'left' | 'hidden') => void,
): void {
  onClose();
  Alert.alert(
    'Leave group',
    'You’ll stop receiving messages from this group. You can be re-added by a member later.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            try {
              const result = await leaveGroupConv(lineOfConv(convId));
              onAfterLeave?.(result);
              if (context === 'view') router.replace('/');
            } catch (e) {
              Alert.alert('Couldn’t leave', (e as Error).message ?? 'Unknown error');
            }
          })();
        },
      },
    ],
  );
}

function infoItem(p: { isGroup: boolean; peerAddress?: string | null }): MenuSheetItem | null {
  if (p.isGroup) return { id: 'info', label: 'Group info', icon: 'users' };
  if (p.peerAddress) return { id: 'info', label: 'Profile', icon: 'user' };
  return null;
}

function buildItems(p: {
  isGroup: boolean; peerAddress?: string | null; isUnread: boolean;
  isPinned: boolean; isArchived: boolean; onSearch?: () => void;
}): MenuSheetItem[] {
  const info = infoItem(p);
  return [
    p.onSearch ? { id: 'search', label: 'Search', icon: 'search' } : null,
    p.isGroup ? { id: 'add-members', label: 'Add members', icon: 'plus' } : null,
    {
      id: 'toggle-read',
      label: p.isUnread ? 'Mark as read' : 'Mark as unread',
      icon: p.isUnread ? 'check' : 'envelope',
    },
    { id: 'toggle-pin', label: p.isPinned ? 'Unpin' : 'Pin', icon: 'mapPin' },
    info,
    {
      id: 'toggle-archive',
      label: p.isArchived ? 'Unarchive' : 'Archive',
      icon: p.isArchived ? 'arrowUp' : 'archive',
      danger: true,
    },
    p.isGroup ? { id: 'leave', label: 'Leave group', icon: 'arrowLeft', danger: true } : null,
  ].filter((item): item is MenuSheetItem => item !== null);
}

export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned, isArchived,
  visible, onClose, context = 'list', onAfterLeave, onAfterArchive, onSearch,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();

  const run = (fn: () => void): void => { onClose(); fn(); };

  const onToggleArchive = (): void => { run(() => {
    void toggleArchived(convId);
    onAfterArchive?.(!isArchived);
    if (!isArchived && context === 'view') router.replace('/');
  }); };

  const handlers: Record<string, () => void> = {
    search: () => { onClose(); setTimeout(() => onSearch?.(), 0); },
    'add-members': () => { run(() => { router.push({ pathname: '/xmtp/add-members', params: { convId } }); }); },
    'toggle-read': () => { run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); }); },
    'toggle-pin': () => { run(() => { void togglePin(convId); }); },
    info: () => { run(() => {
      if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId } });
      else if (peerAddress) router.push({ pathname: '/user/[address]', params: { address: peerAddress } });
    }); },
    'toggle-archive': onToggleArchive,
    leave: () => { confirmLeaveGroup(convId, context, router, onClose, onAfterLeave); },
  };

  const node: WidgetRoot = menuSheet({
    items: buildItems({ isGroup, peerAddress, isUnread, isPinned, isArchived, onSearch }),
  });
  const actions: PayloadHandlers = {
    [MENU_ITEM_PRESS]: (payload) => {
      const id = payload.id;
      if (typeof id === 'string') handlers[id]?.();
    },
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
      {}
      <Box margin={{ x: -16 }}>
        <ViewHost node={node} actions={actions} />
      </Box>
    </AppModal>
  );
}
