
import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { channelsOverflowItems } from './HomeScreen.model';
import * as Clipboard from 'expo-clipboard';
import { MenuList, MenuRow } from '../MenuRows';
import { AnchoredMenu, menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';

interface HomeOverflowMenuProps {
  color: string;
  onNewGroup: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

export function HomeOverflowMenu({ color, onNewGroup, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const dark = useEffectiveColorScheme() === 'dark';
  const open = anchor !== null;
  const close = (): void => { setAnchor(null); };
  const run = (fn: () => void): void => { close(); fn(); };
  const onCopyAddress = (): void => { run(() => {
    void getActiveAccount().then(acct => {
      if (!acct?.address) return;
      void Clipboard.setStringAsync(acct.address);
      capabilities.toast('Address copied');
    });
  }); };
  const handlers: Record<string, () => void> = {
    new: () => { run(onNewGroup); },
    'copy-address': onCopyAddress,
    profile: () => { run(onProfile); },
    settings: () => { run(onSettings); },
  };

  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          {channelsOverflowItems({ copyAddress: true }).map(item => (
            <MenuRow key={item.id} icon={item.icon} label={item.label} dark={dark} onPress={handlers[item.id] ?? close} />
          ))}
        </MenuList>
      </AnchoredMenu>
    </>
  );
}
