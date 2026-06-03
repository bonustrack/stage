/** In-screen edge-swipe-back for the XMTP conversation screen.
 *
 *  ── Why this lives INSIDE the screen (not the root EdgeSwipeBack overlay) ──
 *  react-native-screens presents each pushed route in its own native RNSScreen
 *  container. A `Gesture.Pan` mounted on the navigator ANCESTOR (the root
 *  EdgeSwipeBack strip) never receives touches that land inside the presented
 *  screen's native sub-tree (the FlatList) on Android — so the overlay approach
 *  did nothing here. Mounting the Pan as a `GestureDetector` that DIRECTLY wraps
 *  the conversation content puts the handler in the same native view sub-tree as
 *  the touch, so it actually receives events.
 *
 *  ── Coexisting with the message FlatList + bubble swipe-to-reply ──────────
 *  This back-pan arms ONLY on a clear RIGHTWARD drag (`activeOffsetX(20)`), and a
 *  vertical move fails it (`failOffsetY([-15,15])`) so the inverted FlatList keeps
 *  scrolling. `simultaneousWithExternalGesture(listRef)` tells RNGH not to make the
 *  list's native scroll and this pan mutually exclusive, so neither deadlocks the
 *  other. The bubble swipe-to-reply arms on a LEFTWARD drag (`activeOffsetX(-15)`),
 *  the exact opposite direction, so the two never arm on the same gesture.
 *
 *  A subtle live translate follows the finger; on release past the threshold (or a
 *  fast flick) we `router.back()`, otherwise the content springs back to 0. */

import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { FlatList } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useRouter, useNavigation } from 'expo-router';

/** Rightward travel (dp) OR min velocity to commit the pop. */
const POP_THRESHOLD = 64;
const POP_VELOCITY = 400;
/** Arm only on a clear rightward drag; a vertical move hands off to the list. */
const ACTIVE_X = 20;
const FAIL_Y = 15;
/** Cap the live drag follow so the screen never slides fully off. */
const MAX_FOLLOW = 120;

export function BackSwipe({
  children, listRef,
}: {
  children: React.ReactNode;
  /** The message FlatList ref — composed simultaneously so scroll & back-pan
   *  don't deadlock. */
  listRef: RefObject<FlatList | null>;
}): React.ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const tx = useSharedValue(0);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) router.back();
  }, [navigation, router]);

  const pan = Gesture.Pan()
    .activeOffsetX(ACTIVE_X)
    .failOffsetY([-FAIL_Y, FAIL_Y])
    /** Don't fight the inverted message list's native vertical scroll. RNGH types
     *  the ref param as `RefObject<… | undefined>`; our list ref is
     *  `RefObject<FlatList | null>` (React's useRef nullable shape), so we widen it
     *  here — the value is the same component instance either way. */
    .simultaneousWithExternalGesture(
      listRef as unknown as RefObject<React.ComponentType | undefined>,
    )
    .onUpdate((e) => {
      'worklet';
      /** Only follow rightward (positive) drags; clamp so it can't run away. */
      tx.value = Math.max(0, Math.min(e.translationX, MAX_FOLLOW));
    })
    .onEnd((e) => {
      'worklet';
      const commit = e.translationX >= POP_THRESHOLD || e.velocityX >= POP_VELOCITY;
      if (commit) runOnJS(goBack)();
      tx.value = withTiming(0, { duration: 180 });
    })
    .onFinalize(() => {
      'worklet';
      tx.value = withTiming(0, { duration: 180 });
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[{ flex: 1 }, style]}>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}
