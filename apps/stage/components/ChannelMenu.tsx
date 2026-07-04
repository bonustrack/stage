
import { Alert } from 'react-native';

import { useRouter } from 'expo-router';
import { resolveIconName } from '@stage-labs/kit/icons';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Row } from './layout';
import { channelMenuItems, type MenuSheetItem } from './ChannelMenu.model';
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

function MenuRow({ item, dark, onPress }: {
  item: MenuSheetItem; dark: boolean; onPress: () => void;
}): React.ReactElement {
  const scheme = dark ? 'dark' : 'light';
  const iconName = item.icon === undefined ? undefined : resolveIconName(item.icon);
  const danger = item.danger === true;
  return (
    <ListViewItem dark={dark} align="center" gap={12} onPress={onPress}>
      <Row align="center" gap={12} flex={1}>
        {iconName === undefined ? null : (
          <Icon
            name={iconName}
            size={22}
            color={resolveColorToken(danger ? 'danger' : 'secondary', scheme)}
            dark={dark}
          />
        )}
        <Text value={item.label} color={danger ? 'danger' : undefined} weight="medium" />
      </Row>
    </ListViewItem>
  );
}

export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned, isArchived,
  visible, onClose, context = 'list', onAfterLeave, onAfterArchive, onSearch,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const dark = useKitScheme() === 'dark';

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

  const items = channelMenuItems(
    { isGroup, hasPeer: !!peerAddress, isUnread, isPinned, isArchived },
    { search: !!onSearch, addMembers: true, pin: true, info: true, leaveGroup: true },
  );

  return (
    <AppModal visible={visible} onClose={onClose}>
      {}
      <Box margin={{ x: -16 }}>
        <ListView dark={dark}>
          {items.map((item) => (
            <MenuRow key={item.id} item={item} dark={dark} onPress={() => { handlers[item.id]?.(); }} />
          ))}
        </ListView>
      </Box>
    </AppModal>
  );
}
