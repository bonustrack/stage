/** Direction-discriminated interactive swipe-back.
 *
 *  Re-adds a finger-tracking "swipe right to go back" gesture WITHOUT the
 *  greediness that killed the previous react-native-screens native-stack
 *  approach (a root full-screen `Gesture.Pan()` with no offset constraints,
 *  which claimed every pan and starved both the inverted-FlatList vertical
 *  scroll and the MessengerBubble leftward swipe-to-reply PanResponder).
 *
 *  Instead this is a plain react-native-gesture-handler `Gesture.Pan()`,
 *  scoped to the screen it wraps, with STRICT directional discrimination so
 *  the three gestures never collide:
 *
 *   - `.activeOffsetX(20)`   — activates ONLY after 20px of RIGHTWARD travel.
 *                              Positive-only threshold ⇒ a leftward drag never
 *                              even arms it, so the bubbles' leftward (dx<-10)
 *                              swipe-to-reply PanResponder is left untouched.
 *   - `.failOffsetY([-12,12])` — if the finger crosses ±12px vertically before
 *                              activating, the gesture FAILS, handing the touch
 *                              stream to the FlatList ⇒ vertical scroll wins.
 *   - rightward-only in onUpdate — translationX is clamped to ≥0, so even an
 *                              over-eager activation can't drag content left.
 *
 *  Because activation requires a clear, mostly-horizontal RIGHTWARD intent, the
 *  catch zone can span (almost) the whole screen — "swipe back from anywhere" —
 *  without being greedy. The wrapped content slides right under the finger; on
 *  release past ~35% width or a fast flick it springs out and calls the back
 *  action, otherwise it springs home. Pure JS (no rn-screens native-stack, no
 *  GestureDetectorProvider) — hot-reloads on the dev client. */

import { useCallback } from 'react';
import { Dimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
/** Past this fraction of screen width on release ⇒ commit the back nav. */
const COMMIT_FRACTION = 0.35;
/** A flick (px/s) past this commits even if short of the distance threshold. */
const FLICK_VELOCITY = 800;

export function SwipeBack({
  children,
  onBack,
  style,
  enabled = true,
}: {
  children: React.ReactNode;
  /** Custom back action. Defaults to expo-router `router.back()`. */
  onBack?: () => void;
  style?: ViewStyle;
  enabled?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const tx = useSharedValue(0);

  const goBack = useCallback(() => {
    if (onBack) onBack();
    else router.back();
  }, [onBack, router]);

  const pan = Gesture.Pan()
    /** Arm ONLY on rightward horizontal intent (positive 20px). A leftward or
     *  vertical-first drag never arms this, so reply + scroll keep their touches. */
    .activeOffsetX(20)
    /** Vertical-first movement → fail → FlatList scroll claims the gesture. */
    .failOffsetY([-12, 12])
    .enabled(enabled)
    .onUpdate(e => {
      /** Rightward only: clamp negatives so leftward drift never pulls content. */
      tx.value = Math.max(0, e.translationX);
    })
    .onEnd(e => {
      const committed =
        e.translationX > SCREEN_W * COMMIT_FRACTION || e.velocityX > FLICK_VELOCITY;
      if (committed) {
        /** Slide fully out, then pop. Reset tx after so a re-mount of this
         *  screen (or a cancelled pop) doesn't leave content shoved offscreen. */
        tx.value = withTiming(SCREEN_W, { duration: 140 }, finished => {
          if (finished) {
            runOnJS(goBack)();
            tx.value = 0;
          }
        });
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[{ flex: 1 }, style, animStyle]}>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}
