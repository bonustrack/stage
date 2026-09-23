import type { ViewStyle } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, viewportFill } from '../layout';
import { usePalette } from '../../lib/theme';
import { useRailTooltip, type RailTooltipState } from '../../lib/railTooltip';
import { TOOLTIP } from '../menuStyle';

type ArrowSide = 'left' | 'up' | 'down';

interface Placement { row: boolean; arrow: ArrowSide; arrowFirst: boolean; style: ViewStyle }

function Bubble({ label }: { label: string }): React.ReactElement {
  const pal = usePalette();
  return (
    <Box background={pal.border} radius={TOOLTIP.radius} padding={{ x: TOOLTIP.padX, y: TOOLTIP.padY }}>
      <Text size="xl" color={pal.link} numberOfLines={1} style={{ lineHeight: TOOLTIP.lineHeight }}>{label}</Text>
    </Box>
  );
}

function arrowStyle(side: ArrowSide, bg: string): ViewStyle {
  const a = TOOLTIP.arrow;
  if (side === 'left') {
    return {
      borderTopWidth: a, borderBottomWidth: a, borderRightWidth: a,
      borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: bg,
    };
  }
  const sides: ViewStyle = { borderLeftWidth: a, borderRightWidth: a, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return side === 'down'
    ? { ...sides, borderTopWidth: a, borderTopColor: bg }
    : { ...sides, borderBottomWidth: a, borderBottomColor: bg };
}

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

function Tip({ tip, bg }: { tip: RailTooltipState; bg: string }): React.ReactElement {
  const { row, arrow, arrowFirst, style } = placementOf(tip);
  const arrowBox = <Box width={0} height={0} style={arrowStyle(arrow, bg)} />;
  return (
    <Box direction={row ? 'row' : undefined} align="center" style={style}>
      {arrowFirst ? arrowBox : null}
      <Bubble label={tip.label} />
      {arrowFirst ? null : arrowBox}
    </Box>
  );
}

export function TooltipHost(): React.ReactElement | null {
  const tip = useRailTooltip();
  const pal = usePalette();
  if (tip === null) return null;
  return (
    <Box pointerEvents="none" style={viewportFill(TOOLTIP.layer)}>
      <Tip tip={tip} bg={pal.border} />
    </Box>
  );
}
