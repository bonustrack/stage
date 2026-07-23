
import { Platform, type ViewStyle } from 'react-native';
import { TOPNAV_HEIGHT } from '../Topnav';

const TAB_BAR_HEIGHT = 60;

export const WEB_TABS_CONTENT_PAD: ViewStyle = Platform.OS === 'web'
  ? { paddingTop: TOPNAV_HEIGHT + 8, paddingBottom: TAB_BAR_HEIGHT + 24 }
  : {};

export const WEB_TABBAR_BOTTOM_PAD: ViewStyle = Platform.OS === 'web'
  ? { paddingBottom: TAB_BAR_HEIGHT + 32 }
  : {};
