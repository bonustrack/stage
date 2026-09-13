import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Col } from './layout';
import { AnchoredMenu, menuPointOf } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme } from '../lib/theme';
import { capabilities } from '../lib/capabilities';
import { profileMenuItems } from './ProfileScreen.model';

export function ProfileMenu({ color, isSelf }: { color: string; isSelf: boolean }): React.ReactElement | null {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const dark = useEffectiveColorScheme() === 'dark';
  const items = profileMenuItems(isSelf);
  if (items.length === 0) return null;
  const close = (): void => { setAnchor(null); };
  const handlers: Record<string, () => void> = {
    edit: () => { close(); capabilities.navigate('/settings/profile'); },
  };
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointOf(e)); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AnchoredMenu visible={anchor !== null} onClose={close} anchor={anchor}>
        <ListView dark={dark}>
          {items.map(item => (
            <ListViewItem key={item.id} dark={dark} onPress={handlers[item.id] ?? close}>
              <Icon name={item.icon} size={20} color={color} />
              <Col flex={1}>
                <Text size="xl" color={color}>{item.label}</Text>
              </Col>
            </ListViewItem>
          ))}
        </ListView>
      </AnchoredMenu>
    </>
  );
}
