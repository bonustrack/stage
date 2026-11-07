import type { ReactNode, Ref } from 'react';
import { View } from 'react-native';
import { shortcutKey, type Shortcut } from './keys/keys.model';
import { hideRailTooltip, hoverRect, showRailTooltip, tooltipLabel, tooltipState, type TooltipPlacement } from './system/railTooltip';

export function HoverTooltip({
  label,
  children,
  placement = 'above',
  shortcut,
  nodeRef,
}: {
  label: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  shortcut?: Shortcut;
  nodeRef?: Ref<View>;
}): React.ReactElement {
  const keyLabel = shortcut === undefined ? undefined : shortcutKey(shortcut);
  return (
    <View
      ref={nodeRef}
      onPointerEnter={(event) => {
        const rect = hoverRect(event);
        if (rect) showRailTooltip(tooltipState(placement, tooltipLabel(label), rect, keyLabel));
      }}
      onPointerLeave={hideRailTooltip}
      onPointerDown={hideRailTooltip}
    >
      {children}
    </View>
  );
}
