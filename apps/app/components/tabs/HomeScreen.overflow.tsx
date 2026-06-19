/** HomeScreen overflow menu - the Home topnav 3-dot (kebab) button + the
 *  bottom-sheet it opens. Declutters the topnav by folding the former
 *  Archived + New-group icons into a single overflow menu, presented as the
 *  app's standard AppModal sheet (same surface + MenuRow pattern as the
 *  per-conversation ChannelMenu). The requests icon stays in the topnav.
 *  Also surfaces the two common account actions (Profile + Settings)
 *  that otherwise live behind the avatar Menu page. */

import { useState } from 'react';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import * as Clipboard from 'expo-clipboard';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { flash } from '../../lib/toast';

interface HomeOverflowMenuProps {
  /** Topnav glyph color (matches the sibling requests icon). */
  color: string;
  /** Open the dedicated Archived channels view (former archive icon action). */
  onArchived: () => void;
  /** Start the new-group flow (former "+" icon action). */
  onNewGroup: () => void;
  /** Open the active account's own profile (via the shared peer profile route). */
  onProfile: () => void;
  /** Open the Settings page. */
  onSettings: () => void;
}

/** Topnav kebab button + its overflow sheet. Owns its own open/close state so
 *  the list view only passes the actions. */
export function HomeOverflowMenu({ color, onArchived, onNewGroup, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const dark = useEffectiveColorScheme() === 'dark';
  /** Close helper. */
  const close = (): void => { setOpen(false); };
  /** Run helper. */
  const run = (fn: () => void): void => { close(); fn(); };
  /** Handle the Copy Address. */
  const onCopyAddress = (): void => { run(() => {
    void getActiveAccount().then(acct => {
      if (!acct?.address) return;
      void Clipboard.setStringAsync(acct.address);
      flash('Address copied');
    });
  }); };

  return (
    <>
      <Pressable onPress={() => { setOpen(true); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AppModal visible={open} onClose={close}>
        {/* Cancel AppModal's 16px ScrollView padding so the list spans edge-to-edge
            and the row content inset (ROW_INSET 16) matches the Settings page. */}
        <ListView dark={dark} style={{ marginHorizontal: -16 }}>
          <OverflowRow icon="plus" label="New group" color={color} dark={dark} onPress={() => { run(onNewGroup); }} />
          <OverflowRow icon="archive" label="Archived" color={color} dark={dark} onPress={() => { run(onArchived); }} />
          <OverflowRow icon="copy" label="Copy address" color={color} dark={dark} onPress={onCopyAddress} />
          <OverflowRow icon="user" label="Profile" color={color} dark={dark} onPress={() => { run(onProfile); }} />
          <OverflowRow icon="cog" label="Settings" color={color} dark={dark} onPress={() => { run(onSettings); }} />
        </ListView>
      </AppModal>
    </>
  );
}

/** The Overflow Row component. */
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
      <Col flex={1}>
        <Text size="xl" color={color}>{label}</Text>
      </Col>
    </ListViewItem>
  );
}
