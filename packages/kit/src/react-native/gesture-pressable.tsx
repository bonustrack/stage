
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

export interface GesturePressableProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onSwipe?: (direction: SwipeDir) => void;
}

const SWIPE_THRESHOLD = 40;

function pickDirection(dx: number, dy: number): SwipeDir | undefined {
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function GesturePressable(props: GesturePressableProps): React.ReactElement {
  const { children, onPress, onLongPress, onSwipe } = props;

  const gesture = useMemo(() => {
    const tap = Gesture.Tap().onEnd((_e, success) => {
      if (success && onPress) runOnJS(onPress)();
    });
    const long = Gesture.LongPress()
      .minDuration(350)
      .onStart(() => {
        if (onLongPress) runOnJS(onLongPress)();
      });
    const pan = Gesture.Pan().onEnd((e) => {
      if (!onSwipe) return;
      const dir = pickDirection(e.translationX, e.translationY);
      if (dir) runOnJS(onSwipe)(dir);
    });
    return Gesture.Exclusive(long, pan, tap);
  }, [onPress, onLongPress, onSwipe]);

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}
