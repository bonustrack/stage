/** Android-safe edge-swipe-back.
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
 *  ── Why the previous wrapper did NOTHING ──────────────────────────────────
 *  The earlier version wrapped a `Gesture.Pan` AROUND the whole navigator
 *  (`<GestureDetector><Box>{children=NativeSwipeStack}</Box></GestureDetector>`).
 *  react-native-screens presents each pushed route inside its OWN native
 *  `RNSScreen` container that the navigator attaches/detaches; touches that land
 *  inside the currently-presented screen are consumed by that screen's native
 *  sub-tree (its ScrollView/FlatList/content) and never bubble out to an RNGH
 *  handler bound to the navigator's ANCESTOR view. That's exactly why rn-screens
 *  ships its own `goBackGesture` instead of letting you Pan-wrap the stack — a
 *  parent-level Pan simply receives no events from inside a pushed screen, so it
 *  never activated and `onEnd` never ran. The `hitSlop({width:28})` strip made
 *  it worse: even the few edge touches that did reach it had to win against the
 *  screen's own native scroll, which it couldn't.
 *
 *  ── The fix: a sibling overlay strip ─────────────────────────────────────
 *  Instead of wrapping, we render `children` (the navigator) and then an
 *  absolutely-positioned left-edge `GestureDetector` strip ON TOP of it, as a
 *  later sibling in the SAME parent. Being painted after (and above) the native
 *  screens, the strip sits in front of whatever screen is presented and receives
 *  the edge touch directly — there is no competing handler beneath it inside the
 *  strip, so the Pan owns the gesture deterministically on EVERY pushed route
 *  (xmtp/group/user/wallet/system/token …). `router.back()` is the stock pop, so
 *  the native slide animation + header back button + hardware back are unchanged.
 *
 *  The strip is only ~24dp wide so it never eats normal taps in the body, and it
 *  disables itself (returns nothing) at the stack root so the (tabs) page's own
 *  left-edge drawer/page-swipe (SwipeTabs/LeftDrawer) keeps the edge there. */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter, useNavigation } from 'expo-router';
import { Box } from './layout';

/** Fraction of the screen width the catch zone spans. Less wanted a WIDE left
 *  zone (≈80%) — not a thin bezel strip — so a lazy thumb anywhere on the left
 *  ~80% of the screen begins the back-swipe. Because the overlay sits ON TOP of
 *  whatever screen is presented, the pan owns the touch deterministically
 *  regardless of the underlying FlatList/composer (which previously ate it). */
const ZONE_FRACTION = 0.8;
/** Horizontal travel (dp) OR min velocity required before we commit the pop. */
const POP_THRESHOLD = 56;
const POP_VELOCITY = 350;
/** Arm the pan on a clearly-rightward drag so a normal tap (no movement) and a
 *  vertical scroll (fails on Y) both pass through to the screen beneath instead
 *  of being captured. A WIDE zone needs a firm horizontal threshold so it never
 *  hijacks taps on message bubbles / buttons that live inside the zone. */
const ACTIVE_X = 24;
const FAIL_Y = 16;

export function EdgeSwipeBack({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  /** Reactive "is there a screen below us?" flag. At the stack root (the (tabs)
   *  page) there's nothing to pop, so we DON'T render the strip at all — the tab
   *  root's own left-edge drawer/page gestures keep the edge. Tracked via the
   *  navigator's 'state' event (expo-router re-exports only a subset of hooks, so
   *  we use `navigation` rather than @react-navigation/native directly). */
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
    /** Arm ONLY on a clearly-rightward drag; a vertical move fails it so any
     *  overlapping vertical scroll keeps scrolling, and a stationary touch (tap)
     *  never activates → it falls through to the screen beneath. This directional
     *  gating is what lets a WIDE zone coexist with taps/scroll on the content. */
    .activeOffsetX(ACTIVE_X)
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onEnd((e) => {
      'worklet';
      if (e.translationX >= POP_THRESHOLD || e.velocityX >= POP_VELOCITY) {
        runOnJS(goBack)();
      }
    });

  return (
    <Box style={{ flex: 1 }}>
      {children}
      {/** Sibling overlay zone painted ON TOP of the native stack — receives the
       *   left-zone touch on whatever screen is presented (see header). Only
       *   mounted when there's something to pop.
       *
       *   No `pointerEvents="box-only"`: a bare View under a GestureDetector is
       *   touch-transparent until the pan ACTIVATES. RNGH only steals the touch
       *   stream once `activeOffsetX` is crossed (a rightward drag); plain taps
       *   and vertical scrolls never activate the pan, so they pass through to the
       *   FlatList / bubbles / composer beneath. A `box-only` (or otherwise
       *   touch-grabbing) overlay this wide would have eaten every tap. */}
      {canGoBack ? (
        <GestureDetector gesture={pan}>
          <Box style={[styles.edge, { height, width: Math.round(width * ZONE_FRACTION) }]} />
        </GestureDetector>
      ) : null}
    </Box>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'transparent',
    zIndex: 9999,
    /** Android: zIndex alone doesn't reliably raise a sibling above a
     *  react-native-screens RNSScreen; elevation lifts it in the native
     *  z-order so the overlay actually sits in front and gets the touch. */
    elevation: 9999,
  },
});
