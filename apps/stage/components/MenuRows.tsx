import { useState, type ReactNode } from 'react';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from './layout';
import { AppIcon } from './widgets';
import { AnchoredMenu, menuPointBelow, useAnchoredMenus } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { withAlpha } from '../lib/theme';
import { MENU_ROW } from './menuStyle';

const COMPACT_PADDING = { paddingTop: MENU_ROW.padY, paddingBottom: MENU_ROW.padY, paddingLeft: MENU_ROW.padX, paddingRight: MENU_ROW.padX };
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
  if (compact) return <Col padding={{ y: MENU_ROW.listPadY }}>{children}</Col>;
  return <ListView dark={dark}>{children}</ListView>;
}

function MenuSeparator(): React.ReactElement {
  const { text } = usePalette();
  return <Col height={MENU_ROW.separator} background={withAlpha(text, MENU_ROW.separatorAlpha)} />;
}

export function MenuRow({ icon, label, onPress, dark, danger, chevron }: {
  icon?: string; label: string; onPress: () => void; dark: boolean; danger?: boolean; chevron?: boolean;
}): React.ReactElement {
  const compact = useAnchoredMenus();
  const tone = danger === true ? 'danger' : 'link';
  return (
    <MenuHover compact={compact}>
      {compact && danger === true ? <MenuSeparator /> : null}
      <ListViewItem dark={dark} onPress={onPress} gap={compact ? MENU_ROW.gap : 12} padding={menuRowPadding(compact)}>
        {icon === undefined ? null : <AppIcon name={icon} size={compact ? MENU_ROW.icon : 22} color={tone} />}
        <Col flex={1}>
          <Text value={label} size="xl" color={tone} truncate style={compact ? { lineHeight: MENU_ROW.lineHeight } : undefined} />
        </Col>
        {chevron === true && !compact ? <AppIcon name="chevronRight" size={18} color="secondary" /> : null}
      </ListViewItem>
    </MenuHover>
  );
}

interface OverflowMenuItem { id: string; label: string; icon: string; danger?: boolean }

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
