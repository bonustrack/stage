
import { Alert } from 'react-native';

import { useRouter } from 'expo-router';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { MenuList, MenuRow } from './MenuRows';
import { channelMenuItems } from './ChannelMenu.model';
import { AnchoredMenu } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { markConvRead, markConvUnread } from '../modules/messaging';
import { togglePin } from '../lib/pins';
import { blockRequestConv, leaveGroupConv, lineOfConv, unacceptConv } from '../modules/messaging';
import { markChatCleared } from '../lib/clearedChats';
import { profileLinkOf } from '../lib/links';

interface ChannelMenuProps {
  convId: string;
  isGroup: boolean;
  peerAddress?: string | null;
  isUnread: boolean;
  isPinned: boolean;
  visible: boolean;
  onClose: () => void;
  anchor?: MenuPoint | null;
  context?: 'list' | 'view';
  onAfterLeave?: (result: 'left' | 'hidden') => void;
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

const DELETE_CHAT_MESSAGE = 'The chat is removed from all your devices. If they write again, it comes back with only the new messages. Delete and block also stops their messages for good.';

function confirmDeleteChat(
  convId: string, peerAddress: string, context: 'list' | 'view',
  router: ReturnType<typeof useRouter>, onClose: () => void,
): void {
  onClose();
  const remove = (block: boolean): void => {
    void (async (): Promise<void> => {
      try {
        await markChatCleared(peerAddress, Date.now());
        void markConvRead(convId);
        if (context === 'view') router.replace('/');
        await (block ? blockRequestConv(convId) : unacceptConv(convId));
      } catch (e) {
        Alert.alert('Couldn’t delete', (e as Error).message ?? 'Unknown error');
      }
    })();
  };
  Alert.alert('Delete chat', DELETE_CHAT_MESSAGE, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { remove(false); } },
    { text: 'Delete and block', style: 'destructive', onPress: () => { remove(true); } },
  ]);
}

export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned,
  visible, onClose, anchor, context = 'list', onAfterLeave, onSearch,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const dark = useKitScheme() === 'dark';

  const run = (fn: () => void): void => { onClose(); fn(); };

  const handlers: Record<string, () => void> = {
    search: () => { onClose(); setTimeout(() => onSearch?.(), 0); },
    'add-members': () => { run(() => { router.push({ pathname: '/add-members', params: { convId } }); }); },
    'toggle-read': () => { run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); }); },
    'toggle-pin': () => { run(() => { void togglePin(convId); }); },
    info: () => { run(() => {
      if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId } });
      else if (peerAddress) router.push(profileLinkOf(peerAddress));
    }); },
    leave: () => { confirmLeaveGroup(convId, context, router, onClose, onAfterLeave); },
    delete: () => { if (peerAddress) confirmDeleteChat(convId, peerAddress, context, router, onClose); },
  };

  const items = channelMenuItems({ isGroup, hasPeer: !!peerAddress, isUnread, isPinned }, { search: !!onSearch });

  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      <MenuList dark={dark}>
        {items.map((item) => (
          <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} dark={dark} onPress={() => { handlers[item.id]?.(); }} />
        ))}
      </MenuList>
    </AnchoredMenu>
  );
}
