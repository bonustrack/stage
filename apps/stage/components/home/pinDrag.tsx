import { useMemo, type ReactNode } from 'react';
import { Vibration } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { CHANNEL_ROW_HEIGHT } from '../ChannelRow';
import { movePin } from '../../lib/pins';
import { usePalette } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/pointer';

const HOLD_MS = 250;
const MOVE_SLOP = 6;
const SHIFT_MS = 120;

export interface PinDrag {
  visible: readonly string[];
  from: SharedValue<number>;
  to: SharedValue<number>;
  offset: SharedValue<number>;
  drop: (from: number, to: number) => void;
}

export function usePinDrag(order: readonly string[], visible: readonly string[]): PinDrag {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const offset = useSharedValue(0);
  return useMemo(() => ({
    visible, from, to, offset,
    drop: (fromIndex, toIndex) => {
      const moved = visible[fromIndex];
      const target = visible[toIndex];
      if (moved !== undefined && target !== undefined && moved !== target) movePin(moved, order.indexOf(target));
    },
  }), [order, visible, from, to, offset]);
}

function lift(): void { Vibration.vibrate(10); }

function shiftFor(index: number, from: number, to: number): number {
  if (index > from && index <= to) return -CHANNEL_ROW_HEIGHT;
  if (index < from && index >= to) return CHANNEL_ROW_HEIGHT;
  return 0;
}

export function PinnedDraggable({ drag, index, onHold, children }: {
  drag: PinDrag; index: number; onHold: (anchor: { x: number; y: number }) => void; children: ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  const count = drag.visible.length;
  const touch = isCoarsePointer();
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onStart(() => {
        drag.from.value = index;
        drag.to.value = index;
        drag.offset.value = 0;
        runOnJS(lift)();
      })
      .onUpdate((e) => {
        drag.offset.value = e.translationY;
        drag.to.value = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / CHANNEL_ROW_HEIGHT)));
      })
      .onEnd((e) => {
        if (Math.abs(e.translationY) >= MOVE_SLOP) runOnJS(drag.drop)(index, drag.to.value);
        else if (touch) runOnJS(onHold)({ x: e.absoluteX, y: e.absoluteY });
      })
      .onFinalize(() => {
        drag.from.value = -1;
        drag.to.value = -1;
        drag.offset.value = 0;
      });
    if (touch) pan.activateAfterLongPress(HOLD_MS);
    else pan.activeOffsetY([-MOVE_SLOP, MOVE_SLOP]);
    pan.config.touchAction = 'pan-y';
    return pan;
  }, [drag, index, count, touch, onHold]);

  const style = useAnimatedStyle(() => {
    const from = drag.from.value;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0, backgroundColor: 'transparent' };
    if (from === index) return { transform: [{ translateY: drag.offset.value }], zIndex: 10, backgroundColor: border };
    const shift = shiftFor(index, from, drag.to.value);
    return { transform: [{ translateY: withTiming(shift, { duration: SHIFT_MS }) }], zIndex: 0, backgroundColor: 'transparent' };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
