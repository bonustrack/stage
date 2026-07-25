
import { Platform, type ViewStyle } from 'react-native';
import { TOPNAV_HEIGHT } from '../Topnav';
import { useWebTabRail } from './useWebTabRail';

const TAB_BAR_HEIGHT = 60;

export function useWebTabsContentPad(): ViewStyle {
  const rail = useWebTabRail();
  if (Platform.OS !== 'web') return {};
  return { paddingTop: TOPNAV_HEIGHT + 8, paddingBottom: rail ? 24 : TAB_BAR_HEIGHT + 24 };
}

export function useWebTabbarBottomPad(): ViewStyle {
  const rail = useWebTabRail();
  if (Platform.OS !== 'web') return {};
  return rail ? {} : { paddingBottom: TAB_BAR_HEIGHT + 32 };
}
