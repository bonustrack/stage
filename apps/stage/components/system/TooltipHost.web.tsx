import { Text } from '@stage-labs/kit/react-native/text';
import { Box, viewportFill } from '../layout';
import { usePalette } from '../../lib/theme';
import { useRailTooltip, type RailTooltipState } from '../../lib/railTooltip';
import { TOOLTIP } from '../menuStyle';

function Bubble({ label }: { label: string }): React.ReactElement {
  const pal = usePalette();
  return (
    <Box background={pal.border} radius={TOOLTIP.radius} padding={{ x: TOOLTIP.padX, y: TOOLTIP.padY }}>
      <Text size="xl" color={pal.link} numberOfLines={1} style={{ lineHeight: TOOLTIP.lineHeight }}>{label}</Text>
    </Box>
  );
}

function Beside({ tip, bg }: { tip: Extract<RailTooltipState, { placement: 'beside' }>; bg: string }): React.ReactElement {
  return (
    <Box
      direction="row" align="center"
      style={{ position: 'absolute', left: tip.anchorRight + TOOLTIP.offset - TOOLTIP.arrow, top: tip.centerY, transform: [{ translateY: '-50%' }] }}
    >
      <Box
        width={0} height={0}
        style={{
          borderTopWidth: TOOLTIP.arrow, borderBottomWidth: TOOLTIP.arrow, borderRightWidth: TOOLTIP.arrow,
          borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: bg,
        }}
      />
      <Bubble label={tip.label} />
    </Box>
  );
}

function Above({ tip, bg }: { tip: Extract<RailTooltipState, { placement: 'above' }>; bg: string }): React.ReactElement {
  return (
    <Box
      align="center"
      style={{ position: 'absolute', left: tip.centerX, top: tip.anchorTop - TOOLTIP.offset + TOOLTIP.arrow, transform: [{ translateX: '-50%' }, { translateY: '-100%' }] }}
    >
      <Bubble label={tip.label} />
      <Box
        width={0} height={0}
        style={{
          borderLeftWidth: TOOLTIP.arrow, borderRightWidth: TOOLTIP.arrow, borderTopWidth: TOOLTIP.arrow,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: bg,
        }}
      />
    </Box>
  );
}

function Below({ tip, bg }: { tip: Extract<RailTooltipState, { placement: 'below' }>; bg: string }): React.ReactElement {
  return (
    <Box
      align="center"
      style={{ position: 'absolute', left: tip.centerX, top: tip.anchorBottom + TOOLTIP.offset - TOOLTIP.arrow, transform: [{ translateX: '-50%' }] }}
    >
      <Box
        width={0} height={0}
        style={{
          borderLeftWidth: TOOLTIP.arrow, borderRightWidth: TOOLTIP.arrow, borderBottomWidth: TOOLTIP.arrow,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: bg,
        }}
      />
      <Bubble label={tip.label} />
    </Box>
  );
}

export function TooltipHost(): React.ReactElement | null {
  const tip = useRailTooltip();
  const pal = usePalette();
  if (tip === null) return null;
  return (
    <Box pointerEvents="none" style={viewportFill(TOOLTIP.layer)}>
      {tip.placement === 'beside' ? <Beside tip={tip} bg={pal.border} /> : null}
      {tip.placement === 'above' ? <Above tip={tip} bg={pal.border} /> : null}
      {tip.placement === 'below' ? <Below tip={tip} bg={pal.border} /> : null}
    </Box>
  );
}
