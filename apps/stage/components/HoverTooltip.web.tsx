import type { ReactNode } from 'react';
import { Box } from './layout';
import { hideRailTooltip, hoverRect, showRailTooltip, tooltipLabel, tooltipState, type TooltipPlacement } from '../lib/railTooltip';

export function HoverTooltip({ label, children, placement = 'above' }: {
  label: string; children: ReactNode; placement?: TooltipPlacement;
}): React.ReactElement {
  return (
    <Box
      onPointerEnter={(event) => {
        const rect = hoverRect(event);
        if (rect) showRailTooltip(tooltipState(placement, tooltipLabel(label), rect));
      }}
      onPointerLeave={hideRailTooltip}
      onPointerDown={hideRailTooltip}
    >
      {children}
    </Box>
  );
}
