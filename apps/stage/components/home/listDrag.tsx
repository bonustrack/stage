import { useCallback, useMemo, type ReactNode } from 'react';
import { Vibration, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type AnimatedStyle, type SharedValue,
} from 'react-native-reanimated';
import { CHANNEL_ROW_HEIGHT } from '../ChannelRow';
import { moveCategory } from '../../lib/channelGroups';
import { movePin } from '../../lib/pins';
import { usePalette } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/webLayout';
import { GROUP_HEADER_HEIGHT } from './GroupHeader';
import type { HomeListItem } from './groups.model';
import {
  NO_BLOCKS, blockShift, dropTarget, sectionBlocks, sectionShape, uniformBlocks, type DragBlocks,
} from './listDrag.model';

const HOLD_MS = 250;
const MOVE_SLOP = 6;
const SHIFT_MS = 120;
const CLICK_GRACE_MS = 300;

export interface ListDrag extends DragBlocks {
  from: SharedValue<number>;
  to: SharedValue<number>;
  offset: SharedValue<number>;
  drop: (from: number, to: number) => void;
}

function useListDrag(blocks: DragBlocks, move: (moved: string, target: string) => void): ListDrag {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const offset = useSharedValue(0);
  return useMemo(() => ({
    ...blocks, from, to, offset,
    drop: (fromIndex, toIndex) => {
      const moved = blocks.ids[fromIndex];
      const target = blocks.ids[toIndex];
      if (moved !== undefined && target !== undefined && moved !== target) move(moved, target);
    },
  }), [blocks, move, from, to, offset]);
}

export function usePinDrag(order: readonly string[], visible: readonly string[]): ListDrag {
  const blocks = useMemo(() => uniformBlocks(visible, CHANNEL_ROW_HEIGHT), [visible]);
  const move = useCallback((moved: string, target: string) => { movePin(moved, order.indexOf(target)); }, [order]);
  return useListDrag(blocks, move);
}

export function useSectionDrag(items: readonly HomeListItem[], grouped: boolean): ListDrag {
  const shape = grouped ? sectionShape(items) : '';
  const blocks = useMemo(
    () => (shape === '' ? NO_BLOCKS : sectionBlocks(items, GROUP_HEADER_HEIGHT, CHANNEL_ROW_HEIGHT)),
    [shape],
  );
  const move = useCallback((moved: string, target: string) => { moveCategory(moved, target, blocks.ids); }, [blocks]);
  return useListDrag(blocks, move);
}

function setDragging(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('stage-dragging', on);
}

let scrollLocked = false;

function blockScroll(event: TouchEvent): void {
  if (scrollLocked && event.cancelable) event.preventDefault();
}

function lockScrollOnLift(node: unknown): void {
  if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
    node.addEventListener('touchmove', blockScroll, { passive: false });
  }
}

function lift(): void {
  scrollLocked = true;
  Vibration.vibrate(10);
}

function settle(): void {
  scrollLocked = false;
  setDragging(false);
}

function swallowClick(event: Event): void {
  event.stopPropagation();
  event.preventDefault();
}

function suppressNextClick(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => { document.removeEventListener('click', swallowClick, { capture: true }); }, CLICK_GRACE_MS);
}

function useBlockStyle(drag: ListDrag, index: number): AnimatedStyle<ViewStyle> {
  const { border } = usePalette();
  return useAnimatedStyle(() => {
    const from = drag.from.value;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0, backgroundColor: 'transparent' };
    if (from === index) return { transform: [{ translateY: drag.offset.value }], zIndex: 10, backgroundColor: border };
    const shift = blockShift(index, from, drag.to.value, drag.heights[from] ?? 0);
    return { transform: [{ translateY: withTiming(shift, { duration: SHIFT_MS }) }], zIndex: 0, backgroundColor: 'transparent' };
  });
}

export function Shifted({ drag, index, children }: {
  drag: ListDrag; index: number; children: ReactNode;
}): React.ReactElement {
  const style = useBlockStyle(drag, index);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function Draggable({ drag, index, onHold, children }: {
  drag: ListDrag; index: number; onHold?: (anchor: { x: number; y: number }) => void; children: ReactNode;
}): React.ReactElement {
  const touch = isCoarsePointer();
  const { tops, heights } = drag;
  const gesture = useMemo(() => {
    const dropped = (fromIndex: number, toIndex: number): void => {
      suppressNextClick();
      drag.drop(fromIndex, toIndex);
    };
    const pan = Gesture.Pan()
      .onBegin(() => { runOnJS(setDragging)(true); })
      .onStart(() => {
        drag.from.value = index;
        drag.to.value = index;
        drag.offset.value = 0;
        runOnJS(lift)();
      })
      .onUpdate((e) => {
        drag.offset.value = e.translationY;
        drag.to.value = dropTarget(tops, heights, index, e.translationY);
      })
      .onEnd((e) => {
        if (Math.abs(e.translationY) >= MOVE_SLOP) runOnJS(dropped)(index, drag.to.value);
        else if (touch && onHold !== undefined) runOnJS(onHold)({ x: e.absoluteX, y: e.absoluteY });
      })
      .onFinalize(() => {
        drag.from.value = -1;
        drag.to.value = -1;
        drag.offset.value = 0;
        runOnJS(settle)();
      });
    if (touch) pan.activateAfterLongPress(HOLD_MS);
    else pan.activeOffsetY([-MOVE_SLOP, MOVE_SLOP]);
    pan.config.touchAction = 'pan-y';
    return pan;
  }, [drag, index, tops, heights, touch, onHold]);
  const style = useBlockStyle(drag, index);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>
        <Animated.View ref={lockScrollOnLift}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
