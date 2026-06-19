/**
 * @file Shared per-conversation action sheet (AppModal bottom sheet) used by both
 *  the channels-list long-press menu and the conversation-view overflow menu,
 *  offering mark read/unread, pin/unpin, group info, add members, profile, leave.
 */

import { Alert } from 'react-native';

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { useRouter } from 'expo-router';
import { Col } from './layout';
import { AppModal } from './AppModal';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { markConvRead, markConvUnread } from '../modules/messaging';
import { togglePin } from '../lib/pins';
import { toggleArchived } from '../lib/archived';
import { leaveGroupConv, lineOfConv } from '../modules/messaging';

export interface ChannelMenuProps {
  /** Conversation id the actions operate on. */
  convId: string;
  /** Display title shown as the sheet header (null hides it). */
  title?: string | null;
  /** Group vs DM — drives Group info vs Profile + Leave-group visibility. */
  isGroup: boolean;
  /** DM peer eth address — required for the Profile navigation (DMs only). */
  peerAddress?: string | null;
  /** Whether the conv currently reads as unread → toggles the read/unread label. */
  isUnread: boolean;
  /** Whether the conv is pinned → toggles the Pin/Unpin label. */
  isPinned: boolean;
  /** Whether the conv is archived → toggles the Archive/Unarchive label. */
  isArchived: boolean;
  /** Sheet visibility (controlled by the parent). */
  visible: boolean;
  onClose: () => void;
  /** Where the menu is mounted — drives post-leave navigation. 'view' pops back to the channels list; 'list' just lets the list reconcile (default). */
  context?: 'list' | 'view';
  /** Optional hook fired after a successful leave (e.g. toast / refresh). */
  onAfterLeave?: (result: 'left' | 'hidden') => void;
  /** Optional hook fired after toggling archive (carries the new state). The conversation view uses this to pop back to the list when archiving. */
  onAfterArchive?: (archived: boolean) => void;
  /** Optional in-conversation search action — when provided (conversation view), a "Search" row is shown that closes the sheet and opens the search topnav. */
  onSearch?: () => void;
}

/** Confirm + run the Leave-group flow (leave via XMTP, then navigate context-aware). */
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

/** Renders the Group-info (group) or Profile (DM) navigation row. */
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

/** Renders the shared per-conversation action sheet (mark read, pin, archive, leave, navigate). */
export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned, isArchived,
  visible, onClose, context = 'list', onAfterLeave, onAfterArchive, onSearch,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = pal.link;
  const danger = pal.danger;

  /** Run helper — close the sheet, then run the action. */
  const run = (fn: () => void): void => { onClose(); fn(); };

  /** Toggle archive, notify, and pop back to the list when archiving from the conversation view. */
  const onToggleArchive = (): void => { run(() => {
    void toggleArchived(convId);
    onAfterArchive?.(!isArchived);
    if (!isArchived && context === 'view') router.replace('/');
  }); };

  return (
    <AppModal visible={visible} onClose={onClose}>
      {/* Cancel AppModal's 16px ScrollView padding so the list spans edge-to-edge. */}
      <ListView dark={dark} style={{ marginHorizontal: -16 }}>
        {onSearch ? (
          // Search needs the sheet GONE first (native RN <Modal> owns IME focus),
          // so close, then fire onSearch on the next macrotask.
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
        {/* Archive / Unarchive — local archived store hides the conv (reversible). */}
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

/** The Menu Row component. */
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
