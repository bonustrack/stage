import { Platform, useWindowDimensions } from 'react-native';
import { desktopTitleBarInset } from './desktopShell';

const WEB_SIDEBAR_MIN_WIDTH = 1100;
const WEB_TOP_BAND = 12;

export const WEB_TAB_RAIL_WIDTH = 72;

export function useWebTabRail(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
}

export function useTopChromeInset(): number {
  const wide = useWebTabRail();
  const desktop = desktopTitleBarInset();
  if (desktop > 0) return desktop;
  return wide ? WEB_TOP_BAND : 0;
}
