import { useState } from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';
import { Tooltip } from '@stage-labs/kit/react-native/tooltip';
import { Box, viewportFill } from '../layout';
import { bubbleShift, useRailTooltip, type RailTooltipState } from '../../lib/railTooltip';
import { TOOLTIP } from '../menuStyle';

type ArrowSide = 'left' | 'up' | 'down';

interface Placement { row: boolean; arrow: ArrowSide; arrowFirst: boolean; style: ViewStyle }

const VIEWPORT_MARGIN = 8;

function placementOf(tip: RailTooltipState): Placement {
  if (tip.placement === 'beside') {
    return {
      row: true, arrow: 'left', arrowFirst: true,
      style: { position: 'absolute', left: tip.anchorRight + TOOLTIP.offset - TOOLTIP.arrow, top: tip.centerY, transform: [{ translateY: '-50%' }] },
    };
  }
  if (tip.placement === 'above') {
    return {
      row: false, arrow: 'down', arrowFirst: false,
      style: { position: 'absolute', left: tip.centerX, top: tip.anchorTop - TOOLTIP.offset + TOOLTIP.arrow, transform: [{ translateX: '-50%' }, { translateY: '-100%' }] },
    };
  }
  return {
    row: false, arrow: 'up', arrowFirst: true,
    style: { position: 'absolute', left: tip.centerX, top: tip.anchorBottom + TOOLTIP.offset - TOOLTIP.arrow, transform: [{ translateX: '-50%' }] },
  };
}

function Tip({ tip }: { tip: RailTooltipState }): React.ReactElement {
  const { arrow, style } = placementOf(tip);
  const viewport = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const centerX = tip.placement === 'beside' ? null : tip.centerX;
  const shift = centerX === null || width === 0 ? 0 : bubbleShift(centerX, width, viewport.width, VIEWPORT_MARGIN);
  return <Tooltip label={tip.label} arrow={arrow} bubbleOffset={shift} onBubbleWidth={setWidth} style={style} />;
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
