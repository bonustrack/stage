import Svg, { Rect } from 'react-native-svg';
import { Box } from '../layout';

const CELL = 100;
const CELLS: readonly (readonly [number, number])[] = [[200, 100], [100, 200], [300, 200], [200, 300]];
const CROPPED_VIEW_BOX = '100 100 300 300';

export function StageLogo({ size, color }: { size: number; color: string }): React.ReactElement {
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
