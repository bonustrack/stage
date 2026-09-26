import { useState } from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';
import { Tooltip, type TooltipArrow } from '@stage-labs/kit/react-native/tooltip';
import { Box, viewportFill } from '../layout';
import { bubbleShift, useRailTooltip, type RailTooltipState } from '../../lib/railTooltip';
import { TOOLTIP } from '../menuStyle';

interface Band { arrow: TooltipArrow; align: 'start' | 'center'; justify: 'start' | 'center' | 'end'; style: ViewStyle }

const VIEWPORT_MARGIN = 8;

function bandOf(tip: RailTooltipState, viewport: { width: number; height: number }): Band {
  if (tip.placement === 'beside') {
    return {
      arrow: 'left', align: 'start', justify: 'center',
      style: { position: 'absolute', left: tip.anchorRight + TOOLTIP.offset - TOOLTIP.arrow, top: tip.centerY - viewport.height, height: viewport.height * 2 },
    };
  }
  const across: ViewStyle = { position: 'absolute', left: tip.centerX - viewport.width, width: viewport.width * 2 };
  if (tip.placement === 'above') {
    return {
      arrow: 'down', align: 'center', justify: 'end',
      style: { ...across, top: 0, height: Math.max(0, tip.anchorTop - TOOLTIP.offset + TOOLTIP.arrow) },
    };
  }
  return { arrow: 'up', align: 'center', justify: 'start', style: { ...across, top: tip.anchorBottom + TOOLTIP.offset - TOOLTIP.arrow } };
}

function Tip({ tip }: { tip: RailTooltipState }): React.ReactElement {
  const viewport = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const band = bandOf(tip, viewport);
  const shift = tip.placement === 'beside' || width === 0 ? 0 : bubbleShift(tip.centerX, width, viewport.width, VIEWPORT_MARGIN);
  return (
    <Box align={band.align} justify={band.justify} style={band.style}>
      <Tooltip label={tip.label} arrow={band.arrow} bubbleOffset={shift} onBubbleWidth={setWidth} />
    </Box>
  );
}

export function TooltipHost(): React.ReactElement | null {
  const tip = useRailTooltip();
  if (tip === null) return null;
  return (
    <Box pointerEvents="none" style={viewportFill(TOOLTIP.layer)}>
      <Tip key={tip.label} tip={tip} />
    </Box>
  );
}
