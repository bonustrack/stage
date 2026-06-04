/** Expo-Router layout bound to react-native-screens' OWN native-stack navigator
 *  (`react-native-screens/native-stack`, which resolves in rn-screens ~4.16).
 *  It renders native screen containers + the slide_from_right transition that
 *  composites the previous screen underneath during a pop (the visual "reveal").
 *
 *  SWIPE-BACK is the rn-screens NATIVE finger-following edge gesture
 *  (`goBackGesture: 'swipeRight'` + `screenEdgeGesture: true`, set in _layout):
 *  the previous screen slides underneath on the native thread (real iOS/Telegram
 *  parallax). Its ScreenGestureDetector `onStart` worklet calls reanimated's
 *  `measure()` — which threw "Value is undefined, expected an Object" on
 *  reanimated 4 (the 3→4 measure() API change broke the mock-ref path), so #204
 *  fell back to JS RNGH Pan shims. With reanimated PINNED BACK TO 3.x that
 *  worklet path works again, so the native gesture is re-enabled and the JS
 *  shims (EdgeSwipeBack / xmtp-conv/BackSwipe) were removed.
 *
 *  `withLayoutContext` is the expo-router primitive that adapts any react-
 *  navigation navigator into a file-based-routing layout, so `<NativeSwipeStack>`
 *  + `<NativeSwipeStack.Screen>` work exactly like `<Stack>` / `<Stack.Screen>`.
 *
 *  Must be rendered inside `GestureDetectorProvider`
 *  (react-native-screens/gesture-handler). */

import { withLayoutContext } from 'expo-router';
import { createNativeStackNavigator } from 'react-native-screens/native-stack';

const { Navigator } = createNativeStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
