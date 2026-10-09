import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type AnimatedStyle, type SharedValue,
} from 'react-native-reanimated';
import { CHANNEL_ROW_HEIGHT } from '../ChannelRow';
import { setChannelCategory } from '../channel/channel.labels';
import { moveCategory } from '../../lib/channelGroups';
import { movePin } from '../../lib/pins';
import { makeListeners } from '../../lib/storeCore';
import { usePalette } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/webLayout';
import { GROUP_HEADER_HEIGHT } from './GroupHeader';
import type { HomeListItem } from './groups.model';
import {
  NO_BLOCKS, NO_ZONES, NO_ROW_MEASUREMENTS, blockShift, categoryZones, dragTarget,
  measuredRowHeights, recordRowMeasurement, rowBlocks, sectionBlocks, sectionShape, type DragBlocks, type RowMeasurements,
} from './listDrag.model';
import { HOLD_MS, MOVE_SLOP, lift, lockScrollOnLift, setDragging, settle, suppressNextClick } from '../dragLift';

const SHIFT_MS = 120;

export interface ListDragMeasurements {
  heights: ReadonlyMap<string, number>;
  measure: (item: HomeListItem, width: number, height: number) => void;
}

function rowMeasurementsStore(): {
  subscribe: (cb: () => void) => () => void;
  get: () => RowMeasurements;
  measure: ListDragMeasurements['measure'];
} {
  let measured = NO_ROW_MEASUREMENTS;
  const { subscribe, notify } = makeListeners();
  return {
    subscribe,
    get: () => measured,
    measure: (item, width, height) => {
      const next = recordRowMeasurement(measured, item, width, height);
      if (next === measured) return;
      measured = next;
      notify();
    },
  };
}

export function useListDragMeasurements(items: readonly HomeListItem[], layoutKey: unknown): ListDragMeasurements {
  const { fontScale } = useWindowDimensions();
  const store = useMemo(rowMeasurementsStore, [layoutKey, fontScale]);
  const measured = useSyncExternalStore(store.subscribe, store.get, store.get);
  const heights = useMemo(() => measuredRowHeights(items, measured), [items, measured]);
  return useMemo(() => ({ heights, measure: store.measure }), [heights, store]);
}

export function MeasuredDragRow({ item, measure, children }: {
  item: HomeListItem; measure: ListDragMeasurements['measure']; children: ReactNode;
}): React.ReactElement {
  const node = useRef<Animated.View>(null);
  useLayoutEffect(() => {
    let current = true;
    node.current?.measure((_x, _y, width, height) => { if (current) measure(item, width, height); });
    return () => { current = false; };
  }, [item, measure]);
  return (
    <Animated.View ref={node} collapsable={false} onLayout={({ nativeEvent: { layout } }) => { measure(item, layout.width, layout.height); }}>
      {children}
    </Animated.View>
  );
}

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

export function usePinDrag(order: readonly string[], visible: readonly string[], heights: ReadonlyMap<string, number>): ListDrag {
  const blocks = useMemo(() => rowBlocks(visible, CHANNEL_ROW_HEIGHT, heights), [visible, heights]);
  const move = useCallback((moved: string, target: string) => { movePin(moved, order.indexOf(target)); }, [order]);
  return useListDrag(blocks, move);
}

function useSectionLayout<T>(
  items: readonly HomeListItem[], on: boolean, heights: ReadonlyMap<string, number>, none: T,
  layout: (items: readonly HomeListItem[], header: number, row: number, measured: ReadonlyMap<string, number>) => T,
): T {
  const shape = on ? sectionShape(items) : '';
  return useMemo(() => (shape === '' ? none : layout(items, GROUP_HEADER_HEIGHT, CHANNEL_ROW_HEIGHT, heights)), [shape, heights]);
}

export function useSectionDrag(items: readonly HomeListItem[], grouped: boolean, heights: ReadonlyMap<string, number>): ListDrag {
  const blocks = useSectionLayout(items, grouped, heights, NO_BLOCKS, sectionBlocks);
  const move = useCallback((moved: string, target: string) => { moveCategory(moved, target, blocks.ids); }, [blocks]);
  return useListDrag(blocks, move);
}

export function useCategoryRowDrag(items: readonly HomeListItem[], byCategory: boolean, heights: ReadonlyMap<string, number>): ListDrag {
  const zones = useSectionLayout(items, byCategory, heights, NO_ZONES, categoryZones);
  const move = useCallback((convId: string, key: string) => {
    const category = zones.categories.get(key);
    if (category !== undefined) setChannelCategory(convId, category);
  }, [zones]);
  return useListDrag(zones.blocks, move);
}

function useBlockStyle(drag: ListDrag, index: number): AnimatedStyle<ViewStyle> {
  const { border, inputBg } = usePalette();
  return useAnimatedStyle(() => {
    const from = drag.from.value;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0, backgroundColor: 'transparent' };
    if (from === index) return { transform: [{ translateY: drag.offset.value }], zIndex: 10, backgroundColor: border };
    if (drag.zones.length > 0) {
      return { transform: [{ translateY: 0 }], zIndex: 0, backgroundColor: drag.zones[index] === drag.to.value ? inputBg : 'transparent' };
    }
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

export function Draggable({ drag, index, onHold, children, shift = true }: {
  drag: ListDrag; index: number; onHold?: (anchor: { x: number; y: number }) => void; children: ReactNode; shift?: boolean;
}): React.ReactElement {
  const touch = isCoarsePointer();
  const { tops, heights, zones } = drag;
  const node = useRef<unknown>(null);
  const holdNode = useCallback((el: unknown) => { node.current = el; lockScrollOnLift(el); }, []);
  const gesture = useMemo(() => {
    const onLift = (): void => { lift(node.current); };
    const dropped = (fromIndex: number, toIndex: number): void => {
      suppressNextClick();
      drag.drop(fromIndex, toIndex);
    };
    const held = (anchor: { x: number; y: number }): void => {
      suppressNextClick();
      onHold?.(anchor);
    };
    const pan = Gesture.Pan()
      .onBegin(() => { runOnJS(setDragging)(true); })
      .onStart(() => {
        drag.from.value = index;
        drag.to.value = index;
        drag.offset.value = 0;
        runOnJS(onLift)();
      })
      .onUpdate((e) => {
        drag.offset.value = e.translationY;
        drag.to.value = dragTarget(tops, heights, zones, index, e.translationY);
      })
      .onEnd((e) => {
        if (Math.abs(e.translationY) >= MOVE_SLOP) runOnJS(dropped)(index, dragTarget(tops, heights, zones, index, e.translationY));
        else if (touch && onHold !== undefined) runOnJS(held)({ x: e.absoluteX, y: e.absoluteY });
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
  }, [drag, index, tops, heights, zones, touch, onHold]);
  const style = useBlockStyle(drag, index);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={shift ? style : undefined}>
        <Animated.View ref={holdNode}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
