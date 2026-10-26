import { useMemo, useState, type ReactNode } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { HoverTooltip } from './HoverTooltip';
import type { Shortcut } from './shortcuts.model';
import { usePalette } from '../lib/theme';
import { Column } from './layout';

export interface HoverHandlers { onHoverIn: () => void; onHoverOut: () => void }

export function useHover(): { hovered: boolean; hoverProps: HoverHandlers } {
  const [hovered, setHovered] = useState(false);
  const hoverProps = useMemo<HoverHandlers>(() => ({
    onHoverIn: () => { setHovered(true); },
    onHoverOut: () => { setHovered(false); },
  }), []);
  return { hovered, hoverProps };
}

export function HoverTint({ children, style }: {
  children: (hovered: boolean) => ReactNode; style?: ViewStyle;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  return (
    <Column
      style={style}
      onPointerEnter={() => { setHovered(true); }}
      onPointerLeave={() => { setHovered(false); }}
    >
      {children(hovered)}
    </Column>
  );
}

export function HoverIconButton({ icon, label, color, size = 24, placement, shortcut, onShortcut, role, expanded, onLayout, onPress, onPointerDown }: {
  icon: CentralIcon; label: string; color: string; size?: number;
  placement?: 'beside' | 'above' | 'below'; shortcut?: Shortcut; onShortcut?: () => void;
  role?: 'button'; expanded?: boolean; onLayout?: (event: LayoutChangeEvent) => void;
  onPress: (event: GestureResponderEvent) => void; onPointerDown?: () => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={label} placement={placement} shortcut={shortcut} onShortcut={onShortcut}>
      <Pressable onPointerDown={onPointerDown} onPress={onPress} onLayout={onLayout} hitSlop={8}
        accessibilityRole={role} accessibilityLabel={label}
        accessibilityState={expanded === undefined ? undefined : { expanded }} aria-expanded={expanded} {...hoverProps}>
        <Glyph icon={icon} size={size} color={hovered ? link : color}/>
      </Pressable>
    </HoverTooltip>
  );
}
