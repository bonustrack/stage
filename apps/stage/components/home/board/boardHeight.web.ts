import type { DimensionValue } from 'react-native';
import { TOPNAV_HEIGHT } from '../../Topnav';
import { useContentViewportHeight } from '../../layout/webLayout';

export function useBoardHeight(): number | undefined {
  return useContentViewportHeight() - TOPNAV_HEIGHT;
}

export function columnMaxHeight(laneHeight: number): DimensionValue | undefined {
  void laneHeight;
  return '100%';
}
