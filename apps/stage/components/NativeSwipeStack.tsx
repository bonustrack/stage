
import { withLayoutContext } from 'expo-router';
import { createStackNavigator } from '@react-navigation/stack';

const { Navigator } = createStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
