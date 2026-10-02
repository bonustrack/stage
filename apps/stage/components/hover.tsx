import { useMemo, useState, type ReactNode } from 'react';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from './layout';
import { HoverTooltip } from './HoverTooltip';
import type { Shortcut } from './shortcuts.model';
import { usePalette } from '../lib/theme';

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
    <Box
      style={style}
      onPointerEnter={() => { setHovered(true); }}
      onPointerLeave={() => { setHovered(false); }}
    >
      {children(hovered)}
    </Box>
  );
}

export function HoverIconButton({ icon, label, color, size = 24, placement, shortcut, onShortcut, role, onPress, onPointerDown }: {
  icon: CentralIcon; label: string; color: string; size?: number;
  placement?: 'beside' | 'above' | 'below'; shortcut?: Shortcut; onShortcut?: () => void;
  role?: 'button'; onPress: (event: GestureResponderEvent) => void; onPointerDown?: () => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={label} placement={placement} shortcut={shortcut} onShortcut={onShortcut}>
      <Pressable onPointerDown={onPointerDown} onPress={onPress} hitSlop={8} accessibilityRole={role} accessibilityLabel={label} {...hoverProps}>
        <Glyph icon={icon} size={size} color={hovered ? link : color}/>
      </Pressable>
    </HoverTooltip>
  );
}
