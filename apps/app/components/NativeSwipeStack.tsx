/** Expo-Router layout bound to @react-navigation/stack's JS card stack.
 *
 *  WHY THE JS STACK (not native-stack): the goal is a finger-following
 *  swipe-back on Android that RENDERS THE PREVIOUS SCREEN behind the current
 *  one (parallax reveal), committing the pop past a threshold. rn-screens'
 *  native-stack only finger-follows on iOS; its Android `goBackGesture` worklet
 *  crashes on reanimated 4 (measure() API change → "Value is undefined,
 *  expected an Object"), and reanimated can't be downgraded (3.x doesn't compile
 *  on RN 0.81 + New Arch). The previous JS shim (EdgeSwipeBack/BackSwipe) only
 *  translateX-dragged the CURRENT screen over a scrim — it never mounted the
 *  route below, so the user saw a black/blank backdrop.
 *
 *  @react-navigation/stack is the legacy PURE-JS card stack: it keeps multiple
 *  cards mounted, and `CardStyleInterpolators.forHorizontalIOS` + the built-in
 *  `gestureEnabled` interactive pan animate BOTH cards together (the previous
 *  card parallaxes in from the left as the current card tracks the finger to the
 *  right). Its gesture is driven by RNGH + reanimated and works on Android. It
 *  has NO native module (deps are JS only: @react-navigation/elements, color,
 *  use-latest-callback) — no APK rebuild needed.
 *
 *  `withLayoutContext` is the expo-router primitive that adapts any react-
 *  navigation navigator into a file-based-routing layout, so `<NativeSwipeStack>`
 *  + `<NativeSwipeStack.Screen>` work exactly like `<Stack>` / `<Stack.Screen>`.
 *
 *  Must be rendered inside a GestureHandlerRootView (provided in _layout). */

import { withLayoutContext } from 'expo-router';
import { createStackNavigator } from '@react-navigation/stack';

const { Navigator } = createStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
