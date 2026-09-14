import { withLayoutContext } from 'expo-router';
import { FlowTabNavigator } from './flowNavigator.web';

export const Tabs = withLayoutContext(FlowTabNavigator);
