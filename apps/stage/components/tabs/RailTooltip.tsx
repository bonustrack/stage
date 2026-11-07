import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { HoverTooltip } from '../HoverTooltip';
import { hideRailTooltip, type TooltipPlacement } from '../system/railTooltip';

export function RailTooltip({
  label,
  onPress,
  style,
  children,
  placement = 'above',
}: {
  label: string;
  onPress: () => void;
  style: React.ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
  placement?: TooltipPlacement;
}): React.ReactElement {
  return (
    <HoverTooltip label={label} placement={placement}>
      <Pressable
        onPress={() => {
          hideRailTooltip();
          onPress();
        }}
        style={style}
        accessibilityLabel={label}
      >
        {children}
      </Pressable>
    </HoverTooltip>
  );
}
