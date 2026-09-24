import { useMemo, useState, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Box } from './layout';

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
