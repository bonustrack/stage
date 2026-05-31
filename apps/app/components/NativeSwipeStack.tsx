/** Expo-Router layout bound to react-native-screens' OWN native-stack navigator
 *  (NOT @react-navigation/native-stack, which expo-router's default `<Stack>`
 *  uses). Only the rn-screens native-stack exposes the interactive,
 *  finger-following `goBackGesture` + `screenEdgeGesture` props that give the
 *  real iOS/Telegram edge swipe-back — previous page sliding underneath on the
 *  native thread (parallax), which a JS gesture can't reproduce.
 *
 *  `withLayoutContext` is the expo-router primitive that adapts any react-
 *  navigation navigator into a file-based-routing layout, so `<NativeSwipeStack>`
 *  + `<NativeSwipeStack.Screen>` work exactly like `<Stack>` / `<Stack.Screen>`
 *  while routing through rn-screens.
 *
 *  Must be rendered inside `GestureDetectorProvider`
 *  (react-native-screens/gesture-handler) — that provider is what wires the
 *  native edge gesture into the RNGH gesture tree so it arbitrates with the
 *  other RNGH gestures in the app (swipe-to-reply, scroll) instead of fighting a
 *  separate touch system. */

import { withLayoutContext } from 'expo-router';
import { createNativeStackNavigator } from 'react-native-screens/native-stack';

const { Navigator } = createNativeStackNavigator();

export const NativeSwipeStack = withLayoutContext(Navigator);
