import type { DimensionValue } from 'react-native';

export function useBoardHeight(): number | undefined {
  return undefined;
}

export function columnMaxHeight(laneHeight: number): DimensionValue | undefined {
  return laneHeight > 0 ? laneHeight : undefined;
}
