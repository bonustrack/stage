import { useState, type ReactNode } from 'react';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from './layout';
import { AppIcon, type AppIconRef } from './widgets';
import { AnchoredMenu, menuPointBelow, menuPointBelowEnd, useAnchoredMenus } from './AnchoredMenu';
import { RoundIconButton } from './RoundIconButton';
import type { MenuPoint } from './AnchoredMenu.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { MENU_ROW } from './menuStyle';
import { DROPDOWN_MENU, DropdownMenuItem, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { useHover } from './hover';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';

const COMPACT_PADDING = { paddingTop: MENU_ROW.padY, paddingBottom: MENU_ROW.padY, paddingLeft: MENU_ROW.padX, paddingRight: MENU_ROW.padX };
export function menuRowPadding(compact: boolean): Record<string, number> | undefined {
  return compact ? COMPACT_PADDING : undefined;
}

export function MenuList({ dark, children }: { dark: boolean; children: ReactNode }): React.ReactElement {
  const compact = useAnchoredMenus();
  if (compact) return <>{children}</>;
  return <ListView dark={dark}>{children}</ListView>;
}

export function MenuRow({ icon, label, onPress, dark, danger, chevron, divider = danger === true }: {
  icon?: AppIconRef; label: string; onPress: () => void; dark: boolean; danger?: boolean; chevron?: boolean;
  divider?: boolean;
}): React.ReactElement {
  const compact = useAnchoredMenus();
  const tone = danger === true ? 'danger' : 'link';
  if (compact) {
    return (
      <>
        {divider ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          label={label} danger={danger} onPress={onPress}
          icon={icon === undefined ? undefined : <AppIcon name={icon} size={DROPDOWN_MENU.icon} color={tone} />}
        />
      </>
    );
  }
  return (
    <ListViewItem dark={dark} onPress={onPress} gap={12}>
      {icon === undefined ? null : <AppIcon name={icon} size={22} color={tone} />}
      <Col flex={1}>
        <Text value={label} size="xl" color={tone} truncate />
      </Col>
      {chevron === true ? <AppIcon name={IconChevronRight} size={18} color="secondary" /> : null}
    </ListViewItem>
  );
}

interface OverflowMenuItem { id: string; label: string; icon: AppIconRef; danger?: boolean }

function OverflowMenuItems({ anchor, onClose, items, onSelect }: {
  anchor: MenuPoint | null; onClose: () => void; items: OverflowMenuItem[]; onSelect: (id: string) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <AnchoredMenu visible={anchor !== null} onClose={onClose} anchor={anchor}>
      <MenuList dark={dark}>
        {items.map((item, index) => (
          <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} dark={dark}
            divider={item.danger === true && index > 0} onPress={() => { onClose(); onSelect(item.id); }} />
        ))}
      </MenuList>
    </AnchoredMenu>
  );
}

const OVERFLOW_TRIGGER_HIT = 40;

export function OverflowMenu({ color, items, onSelect, label, size = 24 }: {
  color: string; items: OverflowMenuItem[]; onSelect: (id: string) => void; label?: string; size?: number;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const { link } = usePalette();
  const trigger = useHover();
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); }} hitSlop={(OVERFLOW_TRIGGER_HIT - size) / 2} accessibilityLabel={label} {...trigger.hoverProps}>
        <Glyph icon={IconDotGrid1x3Vertical} size={size} color={trigger.hovered ? link : color} />
      </Pressable>
      <OverflowMenuItems anchor={anchor} onClose={() => { setAnchor(null); }} items={items} onSelect={onSelect} />
    </>
  );
}

export function RoundOverflowMenu({ items, onSelect, loading, background }: {
  items: OverflowMenuItem[]; onSelect: (id: string) => void; loading?: boolean; background?: string;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  return (
    <>
      <RoundIconButton
        icon={IconDotGrid1x3Vertical} label="More" loading={loading} background={background}
        onPress={(e) => { setAnchor(menuPointBelowEnd(e)); }}
      />
      <OverflowMenuItems anchor={anchor} onClose={() => { setAnchor(null); }} items={items} onSelect={onSelect} />
    </>
  );
}
