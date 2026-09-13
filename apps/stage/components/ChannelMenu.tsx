
import { Alert } from 'react-native';

import { useRouter } from 'expo-router';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { MenuList, MenuRow } from './MenuRows';
import { channelMenuItems } from './ChannelMenu.model';
import { AnchoredMenu } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { markConvRead, markConvUnread } from '../modules/messaging';
import { togglePin } from '../lib/pins';
import { leaveGroupConv, lineOfConv } from '../modules/messaging';
import { profileLinkOf } from '../lib/links';

export interface ChannelMenuProps {
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
  };

  const items = channelMenuItems(
    { isGroup, hasPeer: !!peerAddress, isUnread, isPinned },
    { search: !!onSearch, addMembers: true, pin: true, info: true, leaveGroup: true },
  );

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
