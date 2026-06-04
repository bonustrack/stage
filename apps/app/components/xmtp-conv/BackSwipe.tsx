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
import { Platform } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useRouter, useNavigation } from 'expo-router';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';

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
  const { bg } = usePalette();
  const tx = useSharedValue(0);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) router.back();
  }, [navigation, router]);

  const pan = Gesture.Pan()
    /** iOS: OFF. The native-stack interactive gesture (fullScreenGestureEnabled,
     *  set in _layout) owns swipe-back there and reveals the REAL previous
     *  screen; this JS backdrop-only shim must not compete with it. Android: ON
     *  (no native gesture exists in rn-screens 4.16 — see _layout note). The
     *  bubble swipe-to-reply arms LEFTWARD, opposite this rightward pan, so they
     *  never co-arm regardless. */
    .enabled(Platform.OS === 'android')
    .activeOffsetX(ACTIVE_X)
    .failOffsetY([-FAIL_Y, FAIL_Y])
    /** RNGH wants `RefObject<ComponentType | undefined>`; our list ref is a
     *  nullable FlatList ref. Same instance — widen the type for the call. */
    .simultaneousWithExternalGesture(
      listRef as unknown as RefObject<React.ComponentType<unknown> | undefined>,
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

  /** Moving card: follows the finger + casts a soft shadow on its left edge that
   *  deepens with travel, so it reads as a card sliding away over the backdrop. */
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    shadowOpacity: interpolate(tx.value, [0, 12], [0, 0.28]),
  }));
  /** Backdrop scrim revealed behind the card: theme bg (never black) with a thin
   *  dark overlay that fades from fully dark→lighter as the card slides off, for
   *  an iOS-like dimmed-parallax feel. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, MAX_FOLLOW], [0, 0.18]),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Box style={{ flex: 1, backgroundColor: bg }}>
        {/** Dimmed scrim sits on top of the themed bg, under the moving card. */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
            scrimStyle,
          ]}
        />
        <Reanimated.View
          style={[
            {
              flex: 1,
              backgroundColor: bg,
              // iOS: left-edge drop shadow on the sliding card.
              shadowColor: '#000',
              shadowOffset: { width: -3, height: 0 },
              shadowRadius: 8,
              // Android: elevation reads as an all-round shadow; cheap depth cue.
              elevation: 12,
            },
            style,
          ]}
        >
          {children}
        </Reanimated.View>
      </Box>
    </GestureDetector>
  );
}
