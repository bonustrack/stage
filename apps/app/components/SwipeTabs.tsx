/** Horizontal pager for the four first-level `(tabs)` pages
 *  (Home → Wallet → Notifications → Profile).
 *
 *  TRUE finger-follow paging: all four tab bodies are mounted ONCE, side-by-side
 *  in a row of width `4 × screenWidth`. A reanimated shared value `tx` holds the
 *  strip's translateX = `-index*W + drag`, so during a horizontal drag the
 *  neighbour page slides in tracking the finger (like swipe-back). On release the
 *  strip springs to the nearest page; if the page changed we tell expo-router via
 *  `router.navigate`, which keeps the URL correct and the bottom tab-bar highlight
 *  in sync (the `Tabs` navigator stays the source of truth for routing).
 *
 *  Index ↔ tab-bar ↔ router sync:
 *   - The CURRENT index is derived from the focused route (`usePathname`), so a
 *     deep link to `/wallet` or a tab-bar tap lands the pager on the right page
 *     (we animate `tx` to it).
 *   - On a swipe settle we fire `router.navigate` to the new tab → the URL and the
 *     bottom tab-bar active highlight update.
 *
 *  Gesture discrimination mirrors swipe-to-reply: the Pan only ARMS on a clearly
 *  horizontal drag (`activeOffsetX([-15,15])`) and FAILS the moment the finger
 *  moves vertically (`failOffsetY([-12,12])`) — so the Home FlatList and the
 *  Wallet/Settings ScrollViews keep scrolling vertically. Edges rubber-band (no
 *  wrap). Scoped to `(tabs)` only (mounted from `(tabs)/_layout.tsx`), so the
 *  native-stack swipe-back and the chat swipe-to-reply are untouched.
 *
 *  Pure JS (reanimated + gesture-handler, both already installed) → no new native
 *  module; hot-reloads in the existing dev client. */

import { useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { HomeScreen } from './tabs/HomeScreen';
import { WalletScreen } from './tabs/WalletScreen';
import { ProfileTabScreen } from './tabs/ProfileTab';
import { NotificationsScreen } from './tabs/NotificationsScreen';

/** The shape accepted by an inner scrollable's `simultaneousHandlers` prop and
 *  by each tab body's `panRef` prop. It's a React ref to the pager Pan gesture
 *  — handed DOWN so each page's primary FlatList/ScrollView declares an explicit
 *  SIMULTANEOUS relation with the horizontal pager Pan (RNGH composition), rather
 *  than the two gestures racing through the old heuristic activeOffset arbitration. */
export type SimultaneousRefs = React.RefObject<GestureType | undefined>;

/** Tab order = the order declared in `app/(tabs)/_layout.tsx`. Index 0..3. */
const TAB_ORDER = ['index', 'wallet', 'notifications', 'profile'] as const;
type TabName = (typeof TAB_ORDER)[number];

/** expo-router pathnames for each tab (the `(tabs)` group is path-transparent;
 *  `index` is the group root `/`). */
const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  wallet: '/wallet',
  profile: '/profile',
  notifications: '/notifications',
};

/** The four tab bodies, mounted side-by-side in pager order. Mounting all four
 *  at once is fine (only four screens) and lets each keep its own scroll/state
 *  while the neighbour is already rendered during the drag — so it's visible the
 *  instant the finger moves. */
const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement> = {
  index: HomeScreen,
  wallet: WalletScreen,
  profile: ProfileTabScreen,
  notifications: NotificationsScreen,
};

/** Map the focused pathname → pager index. Unknown / nested paths keep the
 *  current index (the pager isn't mounted off the tabs group anyway). */
function indexOfPathname(pathname: string): number {
  if (pathname === '/' || pathname === '') return 0;
  if (pathname.startsWith('/wallet')) return 1;
  if (pathname.startsWith('/notifications')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

/** Switch tabs if dragged past this fraction of the screen width OR flung. */
const SWITCH_FRACTION = 0.2;
const FLING_VELOCITY = 450;

/** Single pager host. Rendered once from `(tabs)/_layout.tsx` as the scene for
 *  every tab route; the route files themselves are empty placeholders. */
export function TabsPager({ drawerProgress }: { drawerProgress?: SharedValue<number> }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  /** Width of the left drawer — must match LeftDrawer's `W` so a rightward drag
   *  at Home tracks the finger 1:1 into the drawer's open progress. */
  const drawerW = Math.min(width * 0.82, 360);

  const routeIndex = indexOfPathname(pathname);

  /** Stable ref to the pager Pan, handed down to every page so its primary
   *  scrollable declares a SIMULTANEOUS relation with this Pan. With the relation
   *  explicit, RNGH stops heuristically arbitrating the two: the Pan's own
   *  direction gate (`activeOffsetX` arms it, `failOffsetY` kills it) deterministically
   *  decides who drives — horizontal → Pan switches tabs (even when the drag starts
   *  over the list / after scroll momentum), vertical → the scrollable scrolls. */
  const panRef = useRef<GestureType | undefined>(undefined) as SimultaneousRefs;

  /** `tx` = strip translateX. Settled position is `-index*W`. */
  const tx = useSharedValue(-routeIndex * width);
  /** Index the pager is currently resting on (drives gesture clamping + the
   *  navigate on settle). Kept on the UI thread as a shared value, and is the
   *  SINGLE SOURCE OF TRUTH for `tx` during + after a swipe. */
  const index = useSharedValue(routeIndex);
  /** Set by the gesture when IT initiated the route change, so the pathname
   *  re-sync effect below knows the strip is already where it should be and
   *  must NOT re-anchor `tx` (which would kill the in-flight settle spring and
   *  make the next swipe feel like it "needs multiple tries"). */
  const gestureDrivenTo = useSharedValue<number | null>(null);
  /** Last width we anchored to — only re-anchor on a genuine width change
   *  (rotation), never on a bare pathname update. */
  const lastWidth = useSharedValue(width);

  const navigate = (i: number): void => {
    const name = TAB_ORDER[i];
    if (name) router.navigate(TAB_HREF[name]);
  };

  /** Keep the pager in sync when the route changes from OUTSIDE a swipe —
   *  tab-bar tap or a deep link. Animate the strip to the new page. Crucially
   *  this must be a no-op when the gesture itself drove the change. */
  useEffect(() => {
    const widthChanged = lastWidth.value !== width;
    lastWidth.value = width;

    // The gesture already moved (or is springing) to this route — leave it be.
    if (gestureDrivenTo.value === routeIndex) {
      gestureDrivenTo.value = null;
      index.value = routeIndex;
      // Only correct the resting anchor if the device actually rotated.
      if (widthChanged) tx.value = -routeIndex * width;
      return;
    }

    if (index.value !== routeIndex) {
      // External change (tab-bar tap / deep link) → animate to it.
      index.value = routeIndex;
      tx.value = withTiming(-routeIndex * width, { duration: 220 });
    } else if (widthChanged) {
      // Rotation only — re-anchor without animation.
      tx.value = -routeIndex * width;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIndex, width]);

  const pan = Gesture.Pan()
    /** Give the Pan a ref so each page's scrollable can name it in
     *  `simultaneousHandlers` — the explicit relation that removes the
     *  non-deterministic race with the inner scroll. */
    .withRef(panRef)
    /** Arm only on a clearly-horizontal drag; vertical-first wins → scroll.
     *  Lower X threshold than the Y fail-band so a horizontal-first flick arms
     *  reliably on the FIRST try, while any vertical intent still scrolls. */
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const base = -index.value * width;
      let drag = e.translationX;
      /** Home + rightward drag → drive the LEFT DRAWER (finger-follow) instead of
       *  rubber-banding the strip. Progress tracks the finger 1:1 over drawerW. */
      if (drawerProgress && index.value === 0 && drag > 0) {
        drawerProgress.value = Math.max(0, Math.min(1, drag / drawerW));
        tx.value = base; // strip stays put while the drawer opens.
        return;
      }
      /** Rubber-band at the edges (no page before the first / after the last). */
      const atStart = index.value === 0 && drag > 0;
      const atEnd = index.value === TAB_ORDER.length - 1 && drag < 0;
      if (atStart || atEnd) drag *= 0.25;
      tx.value = base + drag;
    })
    .onEnd((e) => {
      'worklet';
      /** Settle the drawer if this was a Home rightward (drawer) drag. */
      if (drawerProgress && index.value === 0 && e.translationX > 0) {
        const openIt = e.translationX > drawerW * 0.4 || e.velocityX > FLING_VELOCITY;
        drawerProgress.value = withSpring(openIt ? 1 : 0, { damping: 22, stiffness: 240 });
        tx.value = withSpring(0, { damping: 22, stiffness: 240 });
        return;
      }
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
        // Mark the route change as gesture-driven so the pathname re-sync
        // effect doesn't re-anchor `tx` and interrupt this settle spring.
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
            <View key={name} style={{ width }}>
              <Body panRef={panRef} />
            </View>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}
