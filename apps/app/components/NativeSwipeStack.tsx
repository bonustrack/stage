/** Expo-Router native-stack layout used as the app's root navigator.
 *
 *  WHY THIS IS JUST `Stack`:
 *  - It once imported `react-native-screens/native-stack` to use rn-screens' own
 *    interactive `goBackGesture`/`screenEdgeGesture` worklet. On Android
 *    (rn-screens 4.16 + reanimated 4.3.1) that worklet passes a mock animated ref
 *    to reanimated 4's `measure()`, which resolves the screen viewTag to
 *    `undefined` and crashes the first swipe with "Value is undefined, expected
 *    an Object" (redbox in ScreenGestureDetector.tsx measure()). The reanimated
 *    3->4 measure() API change broke that mock-ref path, so the native gesture
 *    cannot run without crashing.
 *  - It then imported the bare `@react-navigation/native-stack`, which is not a
 *    declared dependency of this app and is not guaranteed to be installed at the
 *    top level, so the bundle could fail to resolve it.
 *
 *  expo-router's own `<Stack>` is a fork of `@react-navigation/native-stack`
 *  (expo-router/build/fork/native-stack) that renders through react-native-screens
 *  under the hood. It is always installed (it is how expo-router works), needs no
 *  extra dependency, and gives the native slide transitions.
 *
 *  SWIPE-BACK is NOT driven by rn-screens' crashing `goBackGesture` worklet.
 *  Instead the app uses JS RNGH Pan shims: <EdgeSwipeBack> wraps this navigator
 *  (left-edge -> router.back()) and the conversation screen mounts its own
 *  in-screen <BackSwipe>. The stock pop still plays the native slide, so the
 *  previous screen is revealed. `GestureDetectorProvider` (mounted in _layout)
 *  arbitrates these with the app's other RNGH gestures (swipe-to-reply, scroll). */

import { Stack } from 'expo-router';

export const NativeSwipeStack = Stack;
