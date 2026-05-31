/** Horizontal swipe-to-switch between the four first-level `(tabs)` pages
 *  (Home → Wallet → Profile → Settings). Wrap each tab screen's content in
 *  `<SwipeTabPage tab="...">`; a left swipe goes to the next tab, a right swipe
 *  to the previous one. The expo-router `Tabs` navigator stays the source of
 *  truth, so the bottom tab bar highlight follows automatically and tapping
 *  tabs / deep links keep working — we only fire `router.navigate` on release.
 *
 *  Gesture discrimination mirrors MessengerBubble's swipe-to-reply: the Pan
 *  only ARMS on a clearly-horizontal drag (`activeOffsetX([-15,15])`) and FAILS
 *  the moment the finger moves vertically (`failOffsetY([-12,12])`), so the
 *  Home FlatList + the Wallet/Settings ScrollViews keep scrolling vertically.
 *  The gesture is scoped to the tab screens only (this component isn't used on
 *  pushed routes), so swipe-back-to-go-back on the native stack is untouched.
 *
 *  Pure JS (reanimated + gesture-handler, both already installed) → no new
 *  native module, hot-reloads in the existing dev client. */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

/** Tab order = the order declared in `app/(tabs)/_layout.tsx`. Index 0..3. */
const TAB_ORDER = ['index', 'wallet', 'profile', 'settings'] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** expo-router pathnames for each tab (the `(tabs)` group is path-transparent;
 *  `index` is the group root `/`). */
const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  wallet: '/wallet',
  profile: '/profile',
  settings: '/settings',
};

/** Distance (px) the content can be dragged for visual feedback before it
 *  springs back; the actual switch fires on release past the threshold. */
const MAX_DRAG = 56;
/** Release threshold: switch tabs if dragged past this fraction of the screen
 *  width OR flung fast enough. */
const SWITCH_FRACTION = 0.22;
const FLING_VELOCITY = 700;

export function SwipeTabPage({
  tab, children,
}: {
  tab: TabName;
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);

  const idx = TAB_ORDER.indexOf(tab);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < TAB_ORDER.length - 1;

  const go = (dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= TAB_ORDER.length) return;
    router.navigate(TAB_HREF[TAB_ORDER[target]!]);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        /** Arm only on a clearly-horizontal drag; vertical-first wins → scroll. */
        .activeOffsetX([-15, 15])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          'worklet';
          let t = e.translationX;
          /** Resist dragging past the edges (no tab beyond first/last). */
          if ((t > 0 && !hasPrev) || (t < 0 && !hasNext)) t *= 0.15;
          /** Soft clamp for a rubber-band feel. */
          tx.value = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, t * 0.4));
        })
        .onEnd((e) => {
          'worklet';
          const passed = Math.abs(e.translationX) > width * SWITCH_FRACTION;
          const flung = Math.abs(e.velocityX) > FLING_VELOCITY;
          if (passed || flung) {
            if (e.translationX < 0 && hasNext) runOnJS(go)(1);
            else if (e.translationX > 0 && hasPrev) runOnJS(go)(-1);
          }
          tx.value = withSpring(0, { damping: 20, stiffness: 220 });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasPrev, hasNext, width, idx],
  );

  const style = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
