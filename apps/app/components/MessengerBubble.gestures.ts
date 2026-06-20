import { useMemo, useRef } from 'react';
import { Vibration } from 'react-native';
import type { ViewType as View } from './layout/native';
import { Gesture } from 'react-native-gesture-handler';
import { useGestureHandlerRef } from '@react-navigation/stack';
import {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';

export interface BubbleGestureInput {
  pending?: boolean;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onOpenMenu?: (anchor: { y: number; height: number }) => void;
  onLongPress?: () => void;
}

export interface BubbleGestures {
  rowRef: React.RefObject<View | null>;
  tapGestures: ReturnType<typeof Gesture.Race>;
  swipeStyle: ReturnType<typeof useAnimatedStyle>;
  replyHintStyle: ReturnType<typeof useAnimatedStyle>;
}

function lightHaptic(): void { Vibration.vibrate(10); }

const THRESHOLD = -64;

export function useBubbleGestures(input: BubbleGestureInput): BubbleGestures {
  const { pending, onReply, onReact, onOpenMenu, onLongPress } = input;
  const swipeX = useSharedValue(0);
  const crossed = useSharedValue(false);
  const rowRef = useRef<View>(null);
  const lastAnchor = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const navGestureRef = useGestureHandlerRef() as React.RefObject<React.ComponentType | undefined>;

  const fireReply = (): void => { if (!pending) onReply?.(); };
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
  const onDoubleTap = (): void => { if (!pending) { lightHaptic(); onReact?.('👍'); } };

  const replyPan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetX(15)
    .failOffsetY([-12, 12])
    .simultaneousWithExternalGesture(navGestureRef)
    .onBegin(() => { crossed.value = false; })
    .onChange(e => {
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
    [onReply, pending, swipeX, crossed, navGestureRef]);

  const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) runOnJS(onDoubleTap)();
  }), [onDoubleTap]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(300)
    .onStart(() => { runOnJS(openMenu)(); }), [openMenu]);
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
