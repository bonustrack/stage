import { useState, type ReactNode } from 'react';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from './layout';
import { AppIcon } from './widgets';
import { AnchoredMenu, menuPointBelow, useAnchoredMenus } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme } from '../lib/theme';

const COMPACT_PADDING = { paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14 };
const HOVER_ROW = { dataSet: { stagemenurow: '1' } };

export function MenuHover({ compact, children }: { compact: boolean; children: ReactNode }): React.ReactElement {
  if (!compact) return <>{children}</>;
  return <Col {...HOVER_ROW}>{children}</Col>;
}

export function menuRowPadding(compact: boolean): Record<string, number> | undefined {
  return compact ? COMPACT_PADDING : undefined;
}

export function MenuList({ dark, children }: { dark: boolean; children: ReactNode }): React.ReactElement {
  const compact = useAnchoredMenus();
  if (compact) return <Col padding={{ y: 4 }}>{children}</Col>;
  return <ListView dark={dark}>{children}</ListView>;
}

export function MenuRow({ icon, label, onPress, dark, danger, chevron }: {
  icon?: string; label: string; onPress: () => void; dark: boolean; danger?: boolean; chevron?: boolean;
}): React.ReactElement {
  const compact = useAnchoredMenus();
  const tone = danger === true ? 'danger' : 'link';
  return (
    <MenuHover compact={compact}>
      <ListViewItem dark={dark} onPress={onPress} gap={12} padding={menuRowPadding(compact)}>
        {icon === undefined ? null : <AppIcon name={icon} size={compact ? 16 : 22} color={tone} />}
        <Col flex={1}>
          <Text value={label} size={compact ? 'lg' : 'xl'} color={tone} />
        </Col>
        {chevron === true && !compact ? <AppIcon name="chevronRight" size={18} color="secondary" /> : null}
      </ListViewItem>
    </MenuHover>
  );
}

export interface OverflowMenuItem { id: string; label: string; icon: string; danger?: boolean }

export function OverflowMenu({ color, items, onSelect }: {
  color: string; items: OverflowMenuItem[]; onSelect: (id: string) => void;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const dark = useEffectiveColorScheme() === 'dark';
  const close = (): void => { setAnchor(null); };
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); }} hitSlop={8}>
        <Icon name="dotsVertical" size={24} color={color} />
      </Pressable>
      <AnchoredMenu visible={anchor !== null} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          {items.map(item => (
            <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} dark={dark}
              onPress={() => { close(); onSelect(item.id); }} />
          ))}
        </MenuList>
      </AnchoredMenu>
    </>
  );
}
