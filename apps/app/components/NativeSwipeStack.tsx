/**
 * @file NativeSwipeStack: an expo-router layout bound to @react-navigation/stack's pure-JS card stack for parallax swipe-back on Android.
 */

import { withLayoutContext } from 'expo-router';
import { createStackNavigator } from '@react-navigation/stack';

const { Navigator } = createStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
