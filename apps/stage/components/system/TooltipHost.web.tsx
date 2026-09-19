import { Text } from '@stage-labs/kit/react-native/text';
import { Box, viewportFill } from '../layout';
import { usePalette } from '../../lib/theme';
import { useRailTooltip } from '../../lib/railTooltip';
import { TOOLTIP } from '../menuStyle';

export function TooltipHost(): React.ReactElement | null {
  const tip = useRailTooltip();
  const pal = usePalette();
  if (tip === null) return null;
  return (
    <Box pointerEvents="none" style={viewportFill(TOOLTIP.layer)}>
      <Box
        direction="row" align="center"
        style={{
          position: 'absolute', left: tip.anchorRight + TOOLTIP.offset - TOOLTIP.arrow, top: tip.centerY,
          transform: [{ translateY: '-50%' }],
        }}
      >
        <Box
          width={0} height={0}
          style={{
            borderTopWidth: TOOLTIP.arrow, borderBottomWidth: TOOLTIP.arrow, borderRightWidth: TOOLTIP.arrow,
            borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: pal.border,
          }}
        />
        <Box background={pal.border} radius={TOOLTIP.radius} padding={{ x: TOOLTIP.padX, y: TOOLTIP.padY }}>
          <Text size="xl" color={pal.link} numberOfLines={1} style={{ lineHeight: TOOLTIP.lineHeight }}>{tip.label}</Text>
        </Box>
      </Box>
    </Box>
  );
}
