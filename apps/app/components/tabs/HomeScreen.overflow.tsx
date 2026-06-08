/** HomeScreen overflow menu - the Home topnav 3-dot (kebab) button + the
 *  bottom-sheet it opens. Declutters the topnav by folding the former
 *  Archived + New-group icons into a single overflow menu, presented as the
 *  app's standard AppModal sheet (same surface + MenuRow pattern as the
 *  per-conversation ChannelMenu). The requests icon stays in the topnav.
 *  Also surfaces the two common account actions (Edit profile + Settings)
 *  that otherwise live behind the avatar Menu page. */

import { useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { Box } from '../layout';
import { AppModal } from '../AppModal';
import { useEffectiveColorScheme } from '../../lib/theme';

interface HomeOverflowMenuProps {
  /** Topnav glyph color (matches the sibling requests icon). */
  color: string;
  /** Open the dedicated Archived channels view (former archive icon action). */
  onArchived: () => void;
  /** Start the new-group flow (former "+" icon action). */
  onNewGroup: () => void;
  /** Open the active account's profile page (where Edit profile lives). */
  onEditProfile: () => void;
  /** Open the Settings page. */
  onSettings: () => void;
}

/** Topnav kebab button + its overflow sheet. Owns its own open/close state so
 *  the list view only passes the actions. */
export function HomeOverflowMenu({ color, onArchived, onNewGroup, onEditProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const dark = useEffectiveColorScheme() === 'dark';
  const close = (): void => setOpen(false);
  const run = (fn: () => void): void => { close(); fn(); };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AppModal visible={open} onClose={close}>
        {/* Cancel AppModal's 16px ScrollView padding so the list spans edge-to-edge
            and the row content inset (ROW_INSET 16) matches the Settings page. */}
        <ListView dark={dark} style={{ marginHorizontal: -16 }}>
          <OverflowRow icon="plus" label="New group" color={color} dark={dark} onPress={() => run(onNewGroup)} />
          <OverflowRow icon="archive" label="Archived" color={color} dark={dark} onPress={() => run(onArchived)} />
          <OverflowRow icon="pencil" label="Edit profile" color={color} dark={dark} onPress={() => run(onEditProfile)} />
          <OverflowRow icon="cog" label="Settings" color={color} dark={dark} onPress={() => run(onSettings)} />
        </ListView>
      </AppModal>
    </>
  );
}

function OverflowRow({ icon, label, color, dark, onPress }: {
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
