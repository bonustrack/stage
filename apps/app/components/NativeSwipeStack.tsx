/** Expo-Router layout bound to react-native-screens' OWN native-stack navigator
 *  (`react-native-screens/native-stack`, which resolves in rn-screens ~4.16).
 *  It renders native screen containers + the slide_from_right transition that
 *  composites the previous screen underneath during a pop (the visual "reveal").
 *
 *  SWIPE-BACK is NOT driven by rn-screens' `goBackGesture`/`screenEdgeGesture`
 *  worklet. On Android (rn-screens 4.16 + reanimated 4.3.1) that worklet passes
 *  a mock animated ref to reanimated 4's `measure()`, which resolves the screen
 *  viewTag to `undefined` and crashes the first swipe with "Value is undefined,
 *  expected an Object" (redbox in ScreenGestureDetector.tsx measure()) — the
 *  reanimated 3→4 measure() API change broke that mock-ref path. Instead the app
 *  uses JS RNGH Pan shims: <EdgeSwipeBack> wraps this navigator (left-edge →
 *  router.back()) and the conversation screen mounts its own <BackSwipe>. The
 *  stock pop still plays the native slide, so the previous screen is revealed.
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
