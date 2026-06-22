
import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import * as Clipboard from 'expo-clipboard';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { flash } from '../../lib/toast';

interface HomeOverflowMenuProps {
  color: string;
  onArchived: () => void;
  onNewGroup: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

export function HomeOverflowMenu({ color, onArchived, onNewGroup, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const dark = useEffectiveColorScheme() === 'dark';
  const close = (): void => { setOpen(false); };
  const run = (fn: () => void): void => { close(); fn(); };
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
        {}
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
