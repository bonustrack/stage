import Svg, { Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from '../layout';

const CELL = 100;
const CELLS: readonly (readonly [number, number])[] = [[200, 100], [100, 200], [300, 200], [200, 300]];
const CROPPED_VIEW_BOX = '100 100 300 300';

const STAGE_LOGO_SIZE = 64;

interface StageMarkProps {
  size?: number;
  color: string;
}

export function StageMark({ size = STAGE_LOGO_SIZE, color }: StageMarkProps): React.ReactElement {
  return (
    <Box width={size} height={size}>
      <Svg width={size} height={size} viewBox={CROPPED_VIEW_BOX}>
        {CELLS.map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={CELL} height={CELL} fill={color} />
        ))}
      </Svg>
    </Box>
  );
}

export function StageLogo({ size = STAGE_LOGO_SIZE, color }: StageMarkProps): React.ReactElement {
  return (
    <Pressable onPress={() => { router.navigate('/'); }} hitSlop={8} accessibilityLabel="Stage home">
      <StageMark size={size} color={color} />
    </Pressable>
  );
}
