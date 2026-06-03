/** Android-safe edge-swipe-back (root navigator wrapper).
 *
 *  react-native-screens 4.x only implements the native finger-following back
 *  gesture on iOS — BOTH navigators (react-native-screens/native-stack AND
 *  @react-navigation/native-stack) hardcode `gestureEnabled={false}` on Android
 *  (NativeStackView.native: "we handle system back gestures in JS"). So the
 *  stock `gestureEnabled`/`fullScreenSwipeEnabled` props are a no-op on Android
 *  and give NO swipe-back at all.
 *
 *  The only rn-screens path that DID work on Android was the custom
 *  `goBackGesture` (ScreenGestureDetector), whose Reanimated `onStart` worklet
 *  calls `measure()` on a mocked animated ref and crashes with "Value is
 *  undefined, expected an Object" on the first edge-swipe. We do NOT use it.
 *
 *  ── Approach ──────────────────────────────────────────────────────────────
 *  A plain RNGH `Gesture.Pan` confined to the left edge that calls
 *  `router.back()` once the finger has dragged far enough to the right. It never
 *  touches `measure()`/view tags, so there is no ScreenGestureDetector and no
 *  crash. `router.back()` is the stock pop, so the native slide animation +
 *  header back button + hardware back all keep working unchanged.
 *
 *  This wraps the navigator and works for the SIMPLE pushed screens (wallet,
 *  token, system, user/group profile…) whose content does not own a competing
 *  native scroll over the left edge. The XMTP conversation screen has an
 *  inverted RNGH FlatList that consumes touches inside its own native subtree,
 *  so a navigator-ancestor Pan never receives them there — that screen mounts
 *  its own in-screen `BackSwipe` (components/xmtp-conv/BackSwipe) that wraps the
 *  feed directly and composes `simultaneousWithExternalGesture` with the list.
 *
 *  Regression note (fixed here): commit 8e58eca replaced this wrap with an
 *  absolutely-positioned transparent `box-only` overlay strip that relied on
 *  z-index to sit above the presented route. On Android a sibling RN view can't
 *  reliably layer above an rn-screens native RNSScreen container, so the strip
 *  received no touches and the edge swipe — which had been working earlier with
 *  the wrap — stopped firing on every screen. Reverted to the wrap. */

import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter, useNavigation } from 'expo-router';
import { Box } from './layout';

/** Width of the left-edge catch zone (dp). We confine the Pan recognizer to
 *  this strip via `hitSlop`, so a drag must START at the left edge — deeper
 *  horizontal scrolls/carousels never trigger a pop. Generous enough to catch a
 *  thumb at the bezel, matching the iOS interactive-pop feel. */
const EDGE_WIDTH = 40;
/** Horizontal travel (dp) OR min velocity required before we commit the pop. */
const POP_THRESHOLD = 56;
const POP_VELOCITY = 350;

export function EdgeSwipeBack({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  /** Reactive "is there a screen below us?" flag. When we're at the bottom
   *  (the (tabs) root) there's nothing to pop, so we DISABLE the recognizer
   *  entirely. That both avoids a useless no-op AND yields the left edge back to
   *  the tab root's own drawer-open / page-swipe gestures (SwipeTabs/LeftDrawer).
   *  We track it via the navigator's 'state' event (no @react-navigation/native
   *  dep — expo-router only re-exports a subset of hooks). */
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    const sync = (): void => setCanGoBack(navigation.canGoBack());
    sync();
    const unsub = navigation.addListener('state', sync);
    return unsub;
  }, [navigation]);

  /** Pop guard: only `router.back()` when there's a screen beneath us, so a
   *  botched restore (empty stack) can't crash on pop. */
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) router.back();
  }, [navigation, router]);

  const pan = Gesture.Pan()
    /** Off at the stack root (see canGoBack above) — no conflict with the tab
     *  root's own left-edge gestures. */
    .enabled(canGoBack)
    /** Confine activation to the left edge: a width-limited hit area means only
     *  the leftmost EDGE_WIDTH dp can begin the gesture. */
    .hitSlop({ left: 0, width: EDGE_WIDTH })
    /** Recognize only rightward horizontal drags; let vertical scroll win. */
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      'worklet';
      if (e.translationX >= POP_THRESHOLD || e.velocityX >= POP_VELOCITY) {
        runOnJS(goBack)();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Box style={{ flex: 1, width }}>{children}</Box>
    </GestureDetector>
  );
}
