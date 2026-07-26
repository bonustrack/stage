
import { Platform, useWindowDimensions } from 'react-native';

const WEB_SIDEBAR_MIN_WIDTH = 1100;

export const WEB_TAB_RAIL_WIDTH = 72;

export function useWebTabRail(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
}
