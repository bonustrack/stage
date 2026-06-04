/** Interactive native-stack with a true swipe-back gesture.
 *
 *  expo-router's default `Stack` renders through @react-navigation/native-stack,
 *  whose 7.x build does NOT wire react-native-screens' `goBackGesture` /
 *  `screenEdgeGesture` — so there's no interactive, finger-tracking swipe-back
 *  (the previous page sliding underneath your thumb).
 *
 *  react-native-screens ships its OWN native-stack navigator
 *  (`react-native-screens/native-stack`) which DOES support those options. It's
 *  marked "deprecated" upstream but remains fully functional in 4.16 and is the
 *  only path to the reanimated-driven interactive pop. We graft it onto
 *  expo-router via `withLayoutContext` — the exact mechanism expo-router
 *  documents for swapping in a custom React Navigation navigator — so file-based
 *  routing keeps working everywhere; only the underlying navigator changes.
 *
 *  The gesture itself is a reanimated worklet (requires Fabric / new arch, which
 *  this app enables) driven by `GestureDetectorProvider` mounted at the root.
 *  `goBackGesture: 'swipeRight'` auto-selects `ScreenTransition.SwipeRight`, so
 *  the previous screen parallaxes in underneath the finger natively. We scope it
 *  to a left-edge zone via `screenEdgeGesture: true` so it never competes with
 *  in-screen horizontal intent (e.g. the leftward swipe-to-reply on bubbles). */

import { createNativeStackNavigator } from 'react-native-screens/native-stack';
import { withLayoutContext } from 'expo-router';

const { Navigator } = createNativeStackNavigator();

/** expo-router-aware native-stack that honors `goBackGesture`/`screenEdgeGesture`.
 *  Use exactly like expo-router's `<Stack>` (same `<Stack.Screen>` children).
 *
 *  Generics are left to inference: the react-navigation core packages
 *  (`@react-navigation/native` etc.) live nested under expo-router/rn-screens in
 *  the bun store and aren't directly resolvable from this workspace, so importing
 *  their named types here would break module resolution. `withLayoutContext`
 *  infers everything it needs from the `Navigator` component. `Screen.options`
 *  (incl. `goBackGesture`/`screenEdgeGesture`/`stackAnimation`) is still fully
 *  type-checked because those props come from the rn-screens Navigator itself. */
export const NativeSwipeStack = withLayoutContext(Navigator);
