import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { hideRailTooltip, hoverRect, showRailTooltip, tooltipLabel, tooltipState, type TooltipPlacement } from '../../lib/railTooltip';

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
