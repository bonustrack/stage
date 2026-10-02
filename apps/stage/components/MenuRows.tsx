import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { AppIcon, type AppIconRef } from './widgets';
import type { MenuItem } from './appIcons';
import { AnchoredMenu, menuPointBelow, menuPointBelowEnd } from './AnchoredMenu';
import { RoundIconButton } from './RoundIconButton';
import type { MenuPoint } from './AnchoredMenu.model';
import { usePalette } from '../lib/theme';
import { DROPDOWN_MENU, DropdownMenuItem, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { useHover } from './hover';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';

export function MenuRow({ icon, label, onPress, danger, divider = danger === true, selected }: {
  icon?: AppIconRef; label: string; onPress: () => void; danger?: boolean; divider?: boolean; selected?: boolean;
}): React.ReactElement {
  const tone = danger === true ? 'danger' : 'link';
  return (
    <>
      {divider ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem
        label={label} danger={danger} selected={selected} onPress={onPress}
        icon={icon === undefined ? undefined : <AppIcon name={icon} size={DROPDOWN_MENU.icon} color={tone} />}
      />
    </>
  );
}

export type OverflowMenuItem = MenuItem<string, AppIconRef>;

function OverflowMenuItems({ anchor, onClose, items, onSelect }: {
  anchor: MenuPoint | null; onClose: () => void; items: OverflowMenuItem[]; onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <AnchoredMenu visible={anchor !== null} onClose={onClose} anchor={anchor}>
      {items.map((item, index) => (
        <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} selected={item.selected}
          divider={item.danger === true && index > 0} onPress={() => { onClose(); onSelect(item.id); }} />
      ))}
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
