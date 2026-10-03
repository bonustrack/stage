
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MenuRow } from './MenuRows';
import { LEAVE_CHANNEL_CONFIRM, channelMenuItems } from './ChannelMenu.model';
import { AnchoredMenu } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { markConvRead, markConvUnread } from '../lib/channelsCache';
import { togglePin } from '../lib/pins';
import { blockRequestConv, checkConvSync, unacceptConv } from '../lib/xmtp.conv';
import { leaveGroupConv } from '../lib/xmtp.groups';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { markChatCleared } from '../lib/clearedChats';
import { channelProfileLinkOf, profileLinkOf } from '../lib/links';
import { openAddMembers } from '../lib/memberList';
import { capabilities } from '../lib/capabilities';

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
  onEdit?: () => void;
}

function confirmLeaveChannel(
  convId: string, context: 'list' | 'view',
  router: ReturnType<typeof useRouter>,
  onClose: () => void, onAfterLeave?: (result: 'left' | 'hidden') => void,
): void {
  onClose();
  void capabilities.confirm(LEAVE_CHANNEL_CONFIRM).then(async (ok) => {
    if (!ok) return;
    try {
      const result = await leaveGroupConv(lineOfConv(convId));
      onAfterLeave?.(result);
      if (context === 'view') router.replace('/');
    } catch (e) {
      Alert.alert('Couldn’t leave', (e as Error).message ?? 'Unknown error');
    }
  });
}

async function checkSync(convId: string): Promise<void> {
  capabilities.toast('Checking sync…');
  try {
    const { title, message } = await checkConvSync(convId);
    Alert.alert(title, message);
  } catch (e) {
    Alert.alert('Couldn’t check sync', (e as Error).message ?? 'Unknown error');
  }
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
  visible, onClose, anchor, context = 'list', onAfterLeave, onSearch, onEdit,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();

  const run = (fn: () => void): void => { onClose(); fn(); };

  const handlers: Record<string, () => void> = {
    search: () => { onClose(); setTimeout(() => onSearch?.(), 0); },
    'add-members': () => { onClose(); setTimeout(() => { openAddMembers(convId); }, 0); },
    'toggle-read': () => { run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); }); },
    'toggle-pin': () => { run(() => { void togglePin(convId); }); },
    info: () => { run(() => {
      if (isGroup) router.push(channelProfileLinkOf(convId));
      else if (peerAddress) router.push(profileLinkOf(peerAddress));
    }); },
    sync: () => { run(() => { void checkSync(convId); }); },
    edit: () => { onClose(); setTimeout(() => onEdit?.(), 0); },
    leave: () => { confirmLeaveChannel(convId, context, router, onClose, onAfterLeave); },
    delete: () => { if (peerAddress) confirmDeleteChat(convId, peerAddress, context, router, onClose); },
  };

  const items = channelMenuItems({ isGroup, hasPeer: !!peerAddress, isUnread, isPinned }, { search: !!onSearch, edit: !!onEdit });

  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      {items.map((item) => (
        <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} onPress={() => { handlers[item.id]?.(); }} />
      ))}
    </AnchoredMenu>
  );
}
