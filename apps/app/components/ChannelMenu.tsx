/** ChannelMenu — the SINGLE per-conversation action sheet shared by both the
 *  channels-list long-press menu (HomeScreen) and the conversation-view 3-dot
 *  overflow menu ([convId]). Presented as the app's standard bottom sheet
 *  (AppModal) in both places for one consistent, themed surface.
 *
 *  The component owns the actions that only need ids/flags — Mark read/unread
 *  (channelsCache), Pin/Unpin (pins), and navigation to Group info / Profile
 *  (expo-router). Context-specific flows that carry their own confirm dialog
 *  (Leave group) are passed in as optional callbacks by the channel-view caller.
 *
 *  Action visibility:
 *    - Mark read/unread  — both contexts (toggle by `isUnread`)
 *    - Pin / Unpin       — both contexts (toggle by `isPinned`)
 *    - Group info        — groups only (navigates to /group/[convId])
 *    - Add members       — groups only (navigates to /xmtp/add-members)
 *    - Profile           — DMs only, when `peerAddress` is known
 *    - Leave group       — ALL groups, both contexts (built-in confirm + leave)
 */

import { Alert } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { useRouter } from 'expo-router';
import { Box } from './layout';
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
  /** Where the menu is mounted — drives post-leave navigation. 'view' pops back
   *  to the channels list; 'list' just lets the list reconcile (default). */
  context?: 'list' | 'view';
  /** Optional hook fired after a successful leave (e.g. toast / refresh). */
  onAfterLeave?: (result: 'left' | 'hidden') => void;
  /** Optional hook fired after toggling archive (carries the new state). The
   *  conversation view uses this to pop back to the list when archiving. */
  onAfterArchive?: (archived: boolean) => void;
}

export function ChannelMenu({
  convId, isGroup, peerAddress, isUnread, isPinned, isArchived,
  visible, onClose, context = 'list', onAfterLeave, onAfterArchive,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = pal.link;
  const danger = pal.danger;

  const run = (fn: () => void): void => { onClose(); fn(); };

  /** Built-in Leave-group flow — confirm, leave via XMTP, then navigate
   *  context-aware: pop back from the channel view; let the list reconcile. */
  const onLeaveGroup = (): void => {
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
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
      {/* Cancel AppModal's 16px ScrollView padding so the list spans edge-to-edge
          and the row content inset (ROW_INSET 16) matches the Settings page. */}
      <ListView dark={dark} style={{ marginHorizontal: -16 }}>
        {isGroup ? (
          <MenuRow
            icon="plus"
            label="Add members"
            color={head}
            dark={dark}
            onPress={() => run(() => router.push({ pathname: '/xmtp/add-members', params: { convId } }))}
          />
        ) : null}

        <MenuRow
          icon={isUnread ? 'check' : 'envelope'}
          label={isUnread ? 'Mark as read' : 'Mark as unread'}
          color={head}
          dark={dark}
          onPress={() => run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); })}
        />

        <MenuRow
          icon="mapPin"
          label={isPinned ? 'Unpin' : 'Pin'}
          color={head}
          dark={dark}
          onPress={() => run(() => { void togglePin(convId); })}
        />

        {isGroup ? (
          <MenuRow
            icon="users"
            label="Group info"
            color={head}
            dark={dark}
            onPress={() => run(() => router.push({ pathname: '/group/[convId]', params: { convId } }))}
          />
        ) : peerAddress ? (
          <MenuRow
            icon="user"
            label="Profile"
            color={head}
            dark={dark}
            onPress={() => run(() => router.push({ pathname: '/user/[address]', params: { address: peerAddress } }))}
          />
        ) : null}

        {/* Archive / Unarchive — local archived store hides the conv from the
            main inbox (reversible, distinct from block). Shown in destructive red
            and placed just before Leave group. On archive from the conversation
            view, pop back to the list via onAfterArchive. */}
        <MenuRow
          icon={isArchived ? 'arrowUp' : 'archive'}
          label={isArchived ? 'Unarchive' : 'Archive'}
          color={danger}
          dark={dark}
          onPress={() => run(() => {
            void toggleArchived(convId);
            onAfterArchive?.(!isArchived);
            if (!isArchived && context === 'view') router.replace('/');
          })}
        />

        {isGroup ? (
          <MenuRow icon="arrowLeft" label="Leave group" color={danger} dark={dark} onPress={onLeaveGroup} />
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
      <Box style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 18, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      </Box>
    </ListViewItem>
  );
}
