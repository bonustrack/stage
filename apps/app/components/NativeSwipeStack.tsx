/** Expo-Router layout bound to react-native-screens' OWN native-stack navigator
 *  (NOT @react-navigation/native-stack, which expo-router's default `<Stack>`
 *  uses). Only the rn-screens native-stack exposes the interactive,
 *  finger-following `goBackGesture` + `screenEdgeGesture` props that give the
 *  real iOS/Telegram edge swipe-back — previous page sliding underneath on the
 *  native thread (parallax), which a JS gesture can't reproduce.
 *
 *  This subpath (`react-native-screens/native-stack`) exists in rn-screens
 *  ~4.16 (it was REMOVED in 4.25 — the 4.16→4.25 bump is what broke the native
 *  reveal). We are pinned back to 4.16, so it resolves again.
 *
 *  `withLayoutContext` is the expo-router primitive that adapts any react-
 *  navigation navigator into a file-based-routing layout, so `<NativeSwipeStack>`
 *  + `<NativeSwipeStack.Screen>` work exactly like `<Stack>` / `<Stack.Screen>`
 *  while routing through rn-screens.
 *
 *  Must be rendered inside `GestureDetectorProvider`
 *  (react-native-screens/gesture-handler) — that provider wires the native edge
 *  gesture into the RNGH gesture tree so it arbitrates with the app's other RNGH
 *  gestures (swipe-to-reply, scroll) instead of fighting a separate touch
 *  system. */

import { withLayoutContext } from 'expo-router';
import { createNativeStackNavigator } from 'react-native-screens/native-stack';

const { Navigator } = createNativeStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
