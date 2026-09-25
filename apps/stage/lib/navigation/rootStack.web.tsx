import { withLayoutContext } from 'expo-router';
import { FlowStackNavigator, type FlowScreenOptions } from './flowNavigator.web';

export const RootStack = withLayoutContext(FlowStackNavigator);

export function rootStackScreenOptions(): FlowScreenOptions {
  return {};
}

export const TABS_SCREEN_OPTIONS: FlowScreenOptions = {};

export const BOARD_SCREEN_OPTIONS: FlowScreenOptions = {};
