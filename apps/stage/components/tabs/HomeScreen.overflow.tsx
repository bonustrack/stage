
import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { channelsOverflowItems } from './HomeScreen.model';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import * as Clipboard from 'expo-clipboard';
import { Col } from '../layout';
import { AnchoredMenu, menuPointOf } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { flash } from '../../lib/toast';

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
      flash('Address copied');
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
      <Pressable onPress={(e) => { setAnchor(menuPointOf(e)); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <ListView dark={dark}>
          {channelsOverflowItems({ copyAddress: true }).map(item => (
            <OverflowRow
              key={item.id}
              icon={item.icon as HeroIconName}
              label={item.label}
              color={color}
              dark={dark}
              onPress={handlers[item.id] ?? close}
            />
          ))}
        </ListView>
      </AnchoredMenu>
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
      <Col flex={1}>
        <Text size="xl" color={color}>{label}</Text>
      </Col>
    </ListViewItem>
  );
}
