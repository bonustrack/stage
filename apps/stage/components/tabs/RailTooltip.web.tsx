import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { hideRailTooltip, showRailTooltip, tooltipLabel, type RailTooltipState } from '../../lib/railTooltip';

const ICON_HALF = 12;

interface DomRectLike { left: number; top: number; width: number; height: number }

function hoverRect(event: { currentTarget: unknown }): DomRectLike | undefined {
  const target = event.currentTarget as { getBoundingClientRect?: () => DomRectLike } | null;
  return target?.getBoundingClientRect?.();
}

type TooltipPlacement = 'beside' | 'above' | 'below';

function tooltipState(placement: TooltipPlacement, label: string, rect: DomRectLike): RailTooltipState {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  if (placement === 'below') return { placement, label, centerX, anchorBottom: centerY + ICON_HALF };
  if (placement === 'above') return { placement, label, centerX, anchorTop: centerY - ICON_HALF };
  return { placement, label, anchorRight: centerX + ICON_HALF, centerY };
}

export function RailTooltip({ label, onPress, style, children, placement = 'above' }: {
  label: string;
  onPress: () => void;
  style: React.ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
  placement?: TooltipPlacement;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { hideRailTooltip(); onPress(); }} style={style} accessibilityLabel={label}
      onHoverIn={(event) => {
        const rect = hoverRect(event);
        if (rect) showRailTooltip(tooltipState(placement, tooltipLabel(label), rect));
      }}
      onHoverOut={hideRailTooltip}
    >
      {children}
    </Pressable>
  );
}
