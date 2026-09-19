import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { hideRailTooltip, showRailTooltip } from '../../lib/railTooltip';

const ICON_HALF = 12;

interface DomRectLike { left: number; top: number; width: number; height: number }

function hoverRect(event: { currentTarget: unknown }): DomRectLike | undefined {
  const target = event.currentTarget as { getBoundingClientRect?: () => DomRectLike } | null;
  return target?.getBoundingClientRect?.();
}

export function RailTooltip({ label, onPress, style, children }: {
  label: string;
  onPress: () => void;
  style: React.ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { hideRailTooltip(); onPress(); }} style={style} accessibilityLabel={label}
      onHoverIn={(event) => {
        const rect = hoverRect(event);
        if (!rect) return;
        showRailTooltip({ label, anchorRight: rect.left + rect.width / 2 + ICON_HALF, centerY: rect.top + rect.height / 2 });
      }}
      onHoverOut={hideRailTooltip}
    >
      {children}
    </Pressable>
  );
}
