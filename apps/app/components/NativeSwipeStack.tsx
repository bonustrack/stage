/** Expo-Router layout bound to the native-stack navigator.
 *
 *  HISTORY: this used to import from `react-native-screens/native-stack`, but
 *  rn-screens v4 REMOVED its own native-stack JS API (it was deprecated in v6
 *  and v4 supports only `@react-navigation/native-stack` v7 — see rn-screens
 *  README). So the import is now `@react-navigation/native-stack`, which renders
 *  through rn-screens under the hood.
 *
 *  The interactive, finger-following parallax swipe-back (previous page sliding
 *  underneath on the native thread — the real iOS/Telegram look, on BOTH
 *  platforms incl. Android) is driven by rn-screens' OWN `goBackGesture` +
 *  `screenEdgeGesture` props (set in app/_layout.tsx). native-stack v7's
 *  `gestureEnabled`/`fullScreenGestureEnabled` are iOS-ONLY and never reach the
 *  Android gesture, so a small patch on native-stack's NativeStackView forwards
 *  `goBackGesture`/`screenEdgeGesture`/`transitionAnimation` (plus the required
 *  screensRefs/currentScreenId) through to rn-screens' <ScreenStack>, which
 *  wires the Reanimated interactive worklet. `GestureDetectorProvider`
 *  (mounted in _layout) arbitrates it cleanly with the app's other RNGH
 *  gestures (swipe-to-reply, scroll) instead of fighting a separate touch
 *  system.
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
