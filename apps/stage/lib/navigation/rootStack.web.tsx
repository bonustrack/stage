import { withLayoutContext } from 'expo-router';
import { FlowStackNavigator, type FlowScreenOptions } from './flowNavigator.web';

export const RootStack = withLayoutContext(FlowStackNavigator);

export function rootStackScreenOptions(bg: string): FlowScreenOptions {
  return { background: bg };
}

export const TABS_SCREEN_OPTIONS: FlowScreenOptions = {};
