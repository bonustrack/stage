
import { Alert } from 'react-native';

import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/list-view';
import { useRouter } from 'expo-router';
import { Col } from './layout';
import { AppModal } from './AppModal';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
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

function InfoRow({ isGroup, peerAddress, head, dark, run, router, convId }: {
  isGroup: boolean; peerAddress?: string | null; head: string; dark: boolean;
  run: (fn: () => void) => void; router: ReturnType<typeof useRouter>; convId: string;
}): React.ReactElement | null {
  if (isGroup) {
    return (
      <MenuRow icon="users" label="Group info" color={head} dark={dark}
        onPress={() => { run(() => { router.push({ pathname: '/group/[convId]', params: { convId } }); }); }} />
    );
  }
  if (peerAddress) {
    return (
      <MenuRow icon="user" label="Profile" color={head} dark={dark}
        onPress={() => { run(() => { router.push({ pathname: '/user/[address]', params: { address: peerAddress } }); }); }} />
    );
  }
  return null;
}

export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned, isArchived,
  visible, onClose, context = 'list', onAfterLeave, onAfterArchive, onSearch,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = pal.link;
  const danger = pal.danger;

  const run = (fn: () => void): void => { onClose(); fn(); };

  const onToggleArchive = (): void => { run(() => {
    void toggleArchived(convId);
    onAfterArchive?.(!isArchived);
    if (!isArchived && context === 'view') router.replace('/');
  }); };

  return (
    <AppModal visible={visible} onClose={onClose}>
      {}
      <ListView dark={dark} style={{ marginHorizontal: -16 }}>
        {onSearch ? (
          <MenuRow icon="search" label="Search" color={head} dark={dark}
            onPress={() => { onClose(); setTimeout(onSearch, 0); }} />
        ) : null}
        {isGroup ? (
          <MenuRow icon="plus" label="Add members" color={head} dark={dark}
            onPress={() => { run(() => { router.push({ pathname: '/xmtp/add-members', params: { convId } }); }); }} />
        ) : null}
        <MenuRow icon={isUnread ? 'check' : 'envelope'}
          label={isUnread ? 'Mark as read' : 'Mark as unread'} color={head} dark={dark}
          onPress={() => { run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); }); }} />
        <MenuRow icon="mapPin" label={isPinned ? 'Unpin' : 'Pin'} color={head} dark={dark}
          onPress={() => { run(() => { void togglePin(convId); }); }} />
        <InfoRow isGroup={isGroup} peerAddress={peerAddress} head={head} dark={dark}
          run={run} router={router} convId={convId} />
        {}
        <MenuRow icon={isArchived ? 'arrowUp' : 'archive'}
          label={isArchived ? 'Unarchive' : 'Archive'} color={danger} dark={dark}
          onPress={onToggleArchive} />
        {isGroup ? (
          <MenuRow icon="arrowLeft" label="Leave group" color={danger} dark={dark}
            onPress={() => { confirmLeaveGroup(convId, context, router, onClose, onAfterLeave); }} />
        ) : null}
      </ListView>
    </AppModal>
  );
}

function MenuRow({ icon, label, color, dark, onPress }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  color: string;
  dark: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} onPress={onPress}>
      <Icon name={icon} size={20} color={color} />
      <Col flex={1}>
        <Text size="xl" color={color}>{label}</Text>
      </Col>
    </ListViewItem>
  );
}
