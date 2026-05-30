/** EdgeSwipeBack — interactive left-edge swipe-to-go-back for Android (and iOS).
 *
 *  WHY THIS EXISTS: the root expo-router Stack sets `gestureEnabled: true`, which
 *  on iOS gives the native-stack swipe-back. On ANDROID, react-navigation's
 *  native-stack `gestureEnabled` is historically a no-op — Android never wired up
 *  the interactive swipe-pop (react-navigation#6893, #7947). react-native-screens'
 *  newer `goBackGesture` API needs a `GestureDetectorProvider` wrap + a fresh
 *  native build and is still flaky on Android (rn-screens#2103). So we do it in
 *  pure JS with react-native-gesture-handler + reanimated — hot-reloadable, no APK.
 *
 *  HOW: a Gesture.Pan that ONLY activates from the left screen edge (~24px) and
 *  ONLY on rightward motion. The content follows the finger (translateX); past a
 *  distance/velocity threshold on release it animates out and calls `onBack()`
 *  (router.back()). Otherwise it springs back.
 *
 *  CONFLICT AVOIDANCE: the message bubbles own a LEFTWARD swipe-to-reply
 *  (PanResponder, dx ≤ -60). This edge gesture is the opposite direction
 *  (rightward, dx > 0) AND geofenced to the left ~24px of the screen, where no
 *  bubble swipe-to-reply is expected to begin. `activeOffsetX([-10, 10])` +
 *  `failOffsetY` keep it from stealing vertical FlatList scrolls. */

import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const EDGE_WIDTH = 24; // px from the left edge where the gesture may begin
const BACK_DISTANCE_FRAC = 0.4; // swipe past 40% of width → pop
const BACK_VELOCITY = 800; // or a fast flick

export function EdgeSwipeBack({
  onBack,
  enabled = true,
  children,
  style,
}: {
  onBack: () => void;
  enabled?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}): React.ReactElement {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);

  const fire = useCallback(() => onBack(), [onBack]);

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Only start the gesture if the touch began within EDGE_WIDTH of the left edge.
    .hitSlop({ left: 0, width: EDGE_WIDTH })
    // Require a small horizontal intent before claiming the gesture; lets vertical
    // FlatList scrolls and in-bubble interactions win otherwise.
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onUpdate(e => {
      // Rightward only; clamp to [0, width].
      tx.value = Math.max(0, Math.min(width, e.translationX));
    })
    .onEnd(e => {
      const past = tx.value > width * BACK_DISTANCE_FRAC || e.velocityX > BACK_VELOCITY;
      if (past) {
        tx.value = withTiming(width, { duration: 160 }, () => {
          runOnJS(fire)();
        });
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[styles.fill, style, animStyle]}>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
