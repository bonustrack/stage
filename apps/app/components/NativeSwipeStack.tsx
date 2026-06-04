/** Expo-Router layout bound to the native-stack navigator.
 *
 *  HISTORY: this used to import from `react-native-screens/native-stack`, but
 *  rn-screens v4 REMOVED its own native-stack JS API (it was deprecated in v6
 *  and v4 supports only `@react-navigation/native-stack` v7 — see rn-screens
 *  README). So the import is now `@react-navigation/native-stack`, which renders
 *  through rn-screens under the hood.
 *
 *  Swipe-back is NOT driven by rn-screens' own `goBackGesture`/`screenEdgeGesture`
 *  worklet — on Android that worklet calls `measure()` on a mocked
 *  ScreenGestureDetector ref and crashes ("Value is undefined, expected an
 *  Object"). Instead the app uses JS RNGH Pan shims: <EdgeSwipeBack> wraps this
 *  navigator (left-edge → router.back()) and the conversation screen mounts its
 *  own in-screen <BackSwipe>. The stock pop still plays the native slide.
 *  `GestureDetectorProvider` (mounted in _layout) arbitrates the gestures with
 *  the app's other RNGH gestures (swipe-to-reply, scroll).
 *
 *  `withLayoutContext` is the expo-router primitive that adapts any react-
 *  navigation navigator into a file-based-routing layout, so `<NativeSwipeStack>`
 *  + `<NativeSwipeStack.Screen>` work exactly like `<Stack>` / `<Stack.Screen>`.
 *
 *  Must be rendered inside `GestureDetectorProvider`
 *  (react-native-screens/gesture-handler). */

import { withLayoutContext } from 'expo-router';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const { Navigator } = createNativeStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
