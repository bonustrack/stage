import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { AnchoredMenu, menuPointBelow } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { MenuList, MenuRow } from './MenuRows';
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
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AnchoredMenu visible={anchor !== null} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          {items.map(item => (
            <MenuRow key={item.id} icon={item.icon} label={item.label} dark={dark} onPress={handlers[item.id] ?? close} />
          ))}
        </MenuList>
      </AnchoredMenu>
    </>
  );
}
