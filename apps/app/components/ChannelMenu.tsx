/** ChannelMenu — the SINGLE per-conversation action sheet shared by both the
 *  channels-list long-press menu (HomeScreen) and the conversation-view 3-dot
 *  overflow menu ([convId]). Presented as the app's standard bottom sheet
 *  (AppModal) in both places for one consistent, themed surface.
 *
 *  The component owns the actions that only need ids/flags — Mark read/unread
 *  (channelsCache), Pin/Unpin (pins), and navigation to Group info / Profile
 *  (expo-router). Context-specific flows that carry their own confirm dialog or
 *  native state (Leave group, Open as bubble, Float as pill) are passed in as
 *  optional callbacks by the channel-view caller.
 *
 *  Action visibility:
 *    - Mark read/unread  — both contexts (toggle by `isUnread`)
 *    - Pin / Unpin       — both contexts (toggle by `isPinned`)
 *    - Group info        — groups only (navigates to /group/[convId])
 *    - Profile           — DMs only, when `peerAddress` is known
 *    - Leave group       — groups only, when `onLeaveGroup` is supplied
 *    - Open as bubble /
 *      Float as pill     — DMs only, when the matching callback is supplied
 */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { useRouter } from 'expo-router';
import { Col } from './layout';
import { AppModal } from './AppModal';
import { useEffectiveColorScheme } from '../lib/theme';
import { markConvRead, markConvUnread } from '../lib/channelsCache';
import { togglePin } from '../lib/pins';

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
  /** Sheet visibility (controlled by the parent). */
  visible: boolean;
  onClose: () => void;
  /** Group-view only: leave-group flow (owns its own confirm dialog). When
   *  omitted the Leave-group row is hidden (e.g. the list context). */
  onLeaveGroup?: () => void;
  /** DM-view only: pop a floating Android chat-head for this 1-1. */
  onOpenAsBubble?: () => void;
  /** DM-view only: launch the always-on floating voice pill for this peer. */
  onFloatAsPill?: () => void;
}

export function ChannelMenu({
  convId, title, isGroup, peerAddress, isUnread, isPinned,
  visible, onClose, onLeaveGroup, onOpenAsBubble, onFloatAsPill,
}: ChannelMenuProps): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const head = dark ? '#ffffff' : '#000000';
  const danger = dark ? '#ff6b80' : '#b91c1c';

  const run = (fn: () => void): void => { onClose(); fn(); };

  return (
    <AppModal visible={visible} onClose={onClose}>
      <Col gap={4}>
        {title ? (
          <Text
            style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4, paddingBottom: 6 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}

        <MenuRow
          icon={isUnread ? 'check' : 'envelope'}
          label={isUnread ? 'Mark as read' : 'Mark as unread'}
          color={head}
          onPress={() => run(() => { void (isUnread ? markConvRead(convId) : markConvUnread(convId)); })}
        />

        <MenuRow
          icon="mapPin"
          label={isPinned ? 'Unpin' : 'Pin'}
          color={head}
          onPress={() => run(() => { void togglePin(convId); })}
        />

        {isGroup ? (
          <MenuRow
            icon="users"
            label="Group info"
            color={head}
            onPress={() => run(() => router.push({ pathname: '/group/[convId]', params: { convId } }))}
          />
        ) : peerAddress ? (
          <MenuRow
            icon="user"
            label="Profile"
            color={head}
            onPress={() => run(() => router.push({ pathname: '/user/[address]', params: { address: peerAddress } }))}
          />
        ) : null}

        {!isGroup && onOpenAsBubble ? (
          <MenuRow icon="chat" label="Open as bubble" color={head} onPress={onOpenAsBubble} />
        ) : null}
        {!isGroup && onFloatAsPill ? (
          <MenuRow icon="microphone" label="Float as pill" color={head} onPress={onFloatAsPill} />
        ) : null}

        {isGroup && onLeaveGroup ? (
          <MenuRow icon="arrowLeft" label="Leave group" color={danger} onPress={onLeaveGroup} />
        ) : null}

        <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: fg, fontSize: 14, fontFamily: 'Calibre-Medium' }}>Cancel</Text>
        </Pressable>
      </Col>
    </AppModal>
  );
}

function MenuRow({ icon, label, color, onPress }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  color: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <Icon name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: 16, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </Pressable>
  );
}
