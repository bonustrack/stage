/** @file Finger-follow horizontal pager for the three first-level tab pages (Channels/Contacts/Wallet): mounts all bodies side-by-side and syncs the settled page back to expo-router so URL and bottom tab-bar stay in sync. */

import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Box } from './layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';

import {
  FLING_VELOCITY, PAGES, SWITCH_FRACTION, TAB_HREF, TAB_ORDER,
  indexOfPathname,
} from './SwipeTabs.config';

/** Single pager host. Rendered once from `(tabs)/_layout.tsx` as the scene for every tab route; the route files themselves are empty placeholders. */
export function TabsPager(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const routeIndex = indexOfPathname(pathname);

  /** Stable ref to the pager Pan handed to every page so its scrollable declares a SIMULTANEOUS relation; the explicit relation lets the Pan's direction gate (activeOffsetX arms, failOffsetY kills) deterministically decide drive — horizontal switches tabs, vertical scrolls. */
  const panRef = useRef<GestureType | undefined>(undefined);

  /** `tx` = strip translateX. Settled position is `-index*W`. */
  const tx = useSharedValue(-routeIndex * width);
  /** Index the pager is currently resting on (drives gesture clamping + the navigate on settle). Kept on the UI thread as a shared value, and is the SINGLE SOURCE OF TRUTH for `tx` during + after a swipe. */
  const index = useSharedValue(routeIndex);
  /** Set by the gesture when it initiated the route change so the pathname re-sync effect leaves `tx` alone (re-anchoring would kill the in-flight settle spring and make the next swipe feel like it needs multiple tries). */
  const gestureDrivenTo = useSharedValue<number | null>(null);
  /** Last width we anchored to — only re-anchor on a genuine width change (rotation), never on a bare pathname update. */
  const lastWidth = useSharedValue(width);

  /** Navigate helper. */
  const navigate = (i: number): void => {
    const name = TAB_ORDER[i];
    if (name) router.navigate(TAB_HREF[name]);
  };

  /** Keep the pager in sync when the route changes from OUTSIDE a swipe — tab-bar tap or a deep link. Animate the strip to the new page. Crucially this must be a no-op when the gesture itself drove the change. */
  useEffect(() => {
    const widthChanged = lastWidth.value !== width;
    lastWidth.value = width;

    /** The gesture already moved (or is springing) to this route — leave it be. */
    if (gestureDrivenTo.value === routeIndex) {
      gestureDrivenTo.value = null;
      index.value = routeIndex;
      /** Only correct the resting anchor if the device actually rotated. */
      if (widthChanged) tx.value = -routeIndex * width;
      return;
    }

    if (index.value !== routeIndex) {
      /** External change (tab-bar tap / deep link) → animate to it. */
      index.value = routeIndex;
      tx.value = withTiming(-routeIndex * width, { duration: 220 });
    } else if (widthChanged) {
      /** Rotation only — re-anchor without animation. */
      tx.value = -routeIndex * width;
    }
  }, [routeIndex, width]);

  const pan = Gesture.Pan()
    /** Give the Pan a ref so each page's scrollable can name it in `simultaneousHandlers` — the explicit relation that removes the non-deterministic race with the inner scroll. */
    .withRef(panRef)
    /** Arm only on a clearly-horizontal drag; vertical-first wins → scroll. Lower X threshold than the Y fail-band so a horizontal-first flick arms reliably on the FIRST try, while any vertical intent still scrolls. */
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const base = -index.value * width;
      let drag = e.translationX;
      /** HARD-LOCK the leading edge: on the first tab (Home) a rightward drag has nowhere to go, so clamp it to zero — no rubber-band, no overscroll, the strip cannot move right of the first page even slightly. */
      if (index.value === 0 && drag > 0) drag = 0;
      /** Rubber-band only at the trailing edge (no page after the last). */
      else if (index.value === TAB_ORDER.length - 1 && drag < 0) drag *= 0.25;
      tx.value = base + drag;
    })
    .onEnd((e) => {
      'worklet';
      const passed = Math.abs(e.translationX) > width * SWITCH_FRACTION;
      const flung = Math.abs(e.velocityX) > FLING_VELOCITY;
      let target = index.value;
      if (passed || flung) {
        if (e.translationX < 0 && index.value < TAB_ORDER.length - 1) target = index.value + 1;
        else if (e.translationX > 0 && index.value > 0) target = index.value - 1;
      }
      index.value = target;
      tx.value = withSpring(-target * width, {
        damping: 22, stiffness: 240, velocity: e.velocityX,
      });
      if (target !== routeIndex) {
        /** Mark the route change gesture-driven so the pathname re-sync effect doesn't re-anchor `tx` and interrupt this settle spring. */
        gestureDrivenTo.value = target;
        runOnJS(navigate)(target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: width * TAB_ORDER.length,
    flex: 1,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={stripStyle}>
        {TAB_ORDER.map((name) => {
          const Body = PAGES[name];
          return (
            <Box width={width} key={name} style={{ height: '100%' }}>
              <Body panRef={panRef}/>
            </Box>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}
