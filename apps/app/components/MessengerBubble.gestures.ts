/** @file useBubbleGestures — swipe-to-reply pan, double-tap react, and long-press menu wiring for MessengerBubble. */
import { useMemo, useRef } from 'react';
import { Vibration } from 'react-native';
// type-only: rowRef measureInWindow() ref typing. Imported via the sanctioned
// layout/native escape hatch (ViewType) instead of an eslint-disable.
import type { ViewType as View } from './layout/native';
import { Gesture } from 'react-native-gesture-handler';
import { useGestureHandlerRef } from '@react-navigation/stack';
import {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';

/** Inputs the bubble passes to wire up its gesture handlers. */
export interface BubbleGestureInput {
  pending?: boolean;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onOpenMenu?: (anchor: { y: number; height: number }) => void;
  onLongPress?: () => void;
}

/** Gesture handlers + animated styles + the row ref returned to MessengerBubble. */
export interface BubbleGestures {
  rowRef: React.RefObject<View | null>;
  tapGestures: ReturnType<typeof Gesture.Race>;
  swipeStyle: ReturnType<typeof useAnimatedStyle>;
  replyHintStyle: ReturnType<typeof useAnimatedStyle>;
}

/** Light haptic tick via RN's built-in Vibration (no native dep, hot-reloadable; expo-haptics is not installed). */
function lightHaptic(): void { Vibration.vibrate(10); }

const THRESHOLD = -64;

/** Wire swipe-to-reply (leftward pan), double-tap 👍, and long-press menu for a bubble, composed with the navigator back-pan. */
export function useBubbleGestures(input: BubbleGestureInput): BubbleGestures {
  const { pending, onReply, onReact, onOpenMenu, onLongPress } = input;
  const swipeX = useSharedValue(0);
  // Crossed-threshold latch (UI thread) so the haptic fires exactly ONCE per drag.
  const crossed = useSharedValue(false);
  const rowRef = useRef<View>(null);
  // Last measured row rect — opens the menu synchronously while a fresh measure flies.
  const lastAnchor = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  // useGestureHandlerRef() is typed as the broad React.Ref union; the Stack
  // provider always supplies a RefObject, narrow it to the object form.
  const navGestureRef = useGestureHandlerRef() as React.RefObject<React.ComponentType | undefined>;

  /** Fire Reply. */
  const fireReply = (): void => { if (!pending) onReply?.(); };
  /** Open Menu. */
  const openMenu = (): void => {
    if (pending || !onOpenMenu) { if (!onOpenMenu) onLongPress?.(); return; }
    lightHaptic();
    onOpenMenu(lastAnchor.current);
    const node = rowRef.current;
    if (node) node.measureInWindow((_x, y, _w, h) => {
      lastAnchor.current = { y, height: h };
      onOpenMenu({ y, height: h });
    });
  };
  /** Handle the Double Tap. */
  const onDoubleTap = (): void => { if (!pending) { lightHaptic(); onReact?.('👍'); } };

  const replyPan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetX(15)
    .failOffsetY([-12, 12])
    .simultaneousWithExternalGesture(navGestureRef)
    .onBegin(() => { crossed.value = false; })
    .onChange(e => {
      // Bubble follows the finger leftward; clamp at the trigger then add
      // rubber-band resistance (1/3 travel) past it so it feels "caught".
      const raw = Math.min(0, e.translationX);
      const t = THRESHOLD;
      swipeX.value = raw > t ? raw : t + (raw - t) / 3;
      const past = raw <= t;
      if (past && !crossed.value) { crossed.value = true; runOnJS(lightHaptic)(); }
      else if (!past && crossed.value) { crossed.value = false; }
    })
    .onEnd(e => {
      if (e.translationX <= THRESHOLD) runOnJS(fireReply)();
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    })
    .onFinalize(() => {
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    }),
    // fireReply/lightHaptic close over onReply+pending; recreate when they change.
    [onReply, pending, swipeX, crossed, navGestureRef]);

  const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) runOnJS(onDoubleTap)();
  }), [onDoubleTap]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(300)
    .onStart(() => { runOnJS(openMenu)(); }), [openMenu]);
  // Pan owns horizontal swipe-to-reply; long-press and double-tap are mutually
  // exclusive and race against the pan. A plain single tap is intentionally unhandled.
  const tapGestures = useMemo(
    () => Gesture.Race(replyPan, Gesture.Exclusive(longPress, doubleTap)),
    [replyPan, longPress, doubleTap]);

  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [-64, -20, 0], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(swipeX.value, [-64, 0], [1, 0.6], Extrapolation.CLAMP) }],
  }));

  return { rowRef, tapGestures, swipeStyle, replyHintStyle };
}
