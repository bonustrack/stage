import {
  createStackNavigator, TransitionPresets, TransitionSpecs, type StackNavigationOptions,
} from '@react-navigation/stack';
import { withLayoutContext } from 'expo-router';
import { PAGE_GUTTER } from '../../components/layout/gutter';

export const RootStack = withLayoutContext(createStackNavigator().Navigator);

export function rootStackScreenOptions(bg: string): StackNavigationOptions {
  return {
    headerShown: false,
    freezeOnBlur: true,
    cardStyle: { backgroundColor: bg },
    gestureEnabled: true,
    gestureResponseDistance: 9999,
    ...TransitionPresets.SlideFromRightIOS,
    transitionSpec: {
      open: { animation: 'timing', config: { duration: 0 } },
      close: TransitionSpecs.TransitionIOSSpec,
    },
  };
}

export const TABS_SCREEN_OPTIONS: StackNavigationOptions = { animation: 'none', gestureEnabled: false };

export const BOARD_SCREEN_OPTIONS: StackNavigationOptions = { gestureResponseDistance: PAGE_GUTTER };
