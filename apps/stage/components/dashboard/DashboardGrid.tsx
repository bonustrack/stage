import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type AnimatedStyle, type SharedValue,
} from 'react-native-reanimated';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import type { DashboardWidget } from '@stage-labs/client/xmtp/readState';
import type { MenuPoint } from '../AnchoredMenu.model';
import { HOLD_MS, MOVE_SLOP, lift, lockScrollOnLift, setDragging, settle, suppressNextClick } from '../dragLift';
import { Box, PAGE_GUTTER } from '../layout';
import { changeDashboard } from '../../lib/dashboard';
import { usePalette } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/webLayout';
import {
  DASHBOARD_GAP, DASHBOARD_ROW, cellRects, dropTarget, gridColumns, moveWidget, packWidgets, type WidgetRect,
} from './dashboard.model';
import { WidgetCard, WidgetMenu } from './WidgetCard';

const SHIFT_MS = 160;
const INSET = DASHBOARD_GAP / 2;
const LIFTED_OPACITY = 0.9;
const RING: ViewStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', borderRadius: BLOCK_RADIUS_DEFAULT, borderWidth: 2,
};

interface GridDrag {
  from: SharedValue<number>;
  to: SharedValue<number>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
}

function useGridDrag(): GridDrag {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  return useMemo(() => ({ from, to, dx, dy, grabX, grabY }), [from, to, dx, dy, grabX, grabY]);
}

interface CellPosition { x: SharedValue<number>; y: SharedValue<number> }

function useCellPosition(rect: WidgetRect, drops: number): CellPosition {
  const x = useSharedValue(rect.x);
  const y = useSharedValue(rect.y);
  useEffect(() => {
    x.value = withTiming(rect.x, { duration: SHIFT_MS });
    y.value = withTiming(rect.y, { duration: SHIFT_MS });
  }, [x, y, rect.x, rect.y, drops]);
  return useMemo(() => ({ x, y }), [x, y]);
}

interface CellGestureArgs {
  index: number;
  rect: WidgetRect;
  rects: readonly WidgetRect[];
  position: CellPosition;
  drag: GridDrag;
  onDrop: (from: number, to: number) => void;
  onHold: (anchor: MenuPoint) => void;
}

function cellPan({ index, rect, rects, position, drag, onDrop, onHold }: CellGestureArgs, node: { current: unknown }, touch: boolean): PanGesture {
  const onLift = (): void => { lift(node.current); };
  const dropped = (from: number, to: number): void => { suppressNextClick(); onDrop(from, to); };
  const held = (anchor: MenuPoint): void => { suppressNextClick(); onHold(anchor); };
  const pan = Gesture.Pan()
    .onBegin(() => { runOnJS(setDragging)(true); })
    .onStart((e) => {
      drag.grabX.value = e.x - e.translationX;
      drag.grabY.value = e.y - e.translationY;
      drag.dx.value = e.translationX;
      drag.dy.value = e.translationY;
      drag.to.value = index;
      drag.from.value = index;
      runOnJS(onLift)();
    })
    .onUpdate((e) => {
      drag.dx.value = e.translationX;
      drag.dy.value = e.translationY;
      drag.to.value = dropTarget(rects, rect.x + drag.grabX.value + e.translationX, rect.y + drag.grabY.value + e.translationY, index);
    })
    .onEnd((e, success) => {
      if (!success) return;
      if (Math.hypot(e.translationX, e.translationY) >= MOVE_SLOP) {
        position.x.value += e.translationX;
        position.y.value += e.translationY;
        drag.dx.value = 0;
        drag.dy.value = 0;
        runOnJS(dropped)(index, drag.to.value);
      } else if (touch) runOnJS(held)({ x: e.absoluteX, y: e.absoluteY });
    })
    .onFinalize(() => {
      drag.from.value = -1;
      drag.to.value = -1;
      drag.dx.value = 0;
      drag.dy.value = 0;
      runOnJS(settle)();
    });
  if (touch) pan.activateAfterLongPress(HOLD_MS);
  else pan.minDistance(MOVE_SLOP);
  pan.config.touchAction = 'pan-y';
  return pan;
}

function useCellGesture(args: CellGestureArgs): { gesture: PanGesture; holdNode: (el: unknown) => void } {
  const touch = isCoarsePointer();
  const node = useRef<unknown>(null);
  const holdNode = useCallback((el: unknown) => { node.current = el; lockScrollOnLift(el); }, []);
  const { index, rect, rects, position, drag, onDrop, onHold } = args;
  const gesture = useMemo(
    () => cellPan({ index, rect, rects, position, drag, onDrop, onHold }, node, touch),
    [index, rect, rects, position, drag, onDrop, onHold, touch],
  );
  return { gesture, holdNode };
}

function useCellStyles(index: number, drag: GridDrag, position: CellPosition): {
  cell: AnimatedStyle<ViewStyle>; ring: AnimatedStyle<ViewStyle>;
} {
  const cell = useAnimatedStyle(() => {
    const lifted = drag.from.value === index;
    return {
      left: position.x.value,
      top: position.y.value,
      zIndex: lifted ? 10 : 0,
      opacity: lifted ? LIFTED_OPACITY : 1,
      transform: [{ translateX: lifted ? drag.dx.value : 0 }, { translateY: lifted ? drag.dy.value : 0 }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const from = drag.from.value;
    return { opacity: from !== -1 && from !== index && drag.to.value === index ? 1 : 0 };
  });
  return { cell, ring };
}

interface OpenMenu { id: string; anchor: MenuPoint }

function DashboardCell({ widget, index, rect, rects, drag, drops, onDrop, onMenu }: {
  widget: DashboardWidget; index: number; rect: WidgetRect; rects: readonly WidgetRect[]; drag: GridDrag; drops: number;
  onDrop: (from: number, to: number) => void; onMenu: (menu: OpenMenu) => void;
}): React.ReactElement {
  const { link } = usePalette();
  const openMenu = useCallback((anchor: MenuPoint) => { onMenu({ id: widget.id, anchor }); }, [onMenu, widget.id]);
  const position = useCellPosition(rect, drops);
  const { gesture, holdNode } = useCellGesture({ index, rect, rects, position, drag, onDrop, onHold: openMenu });
  const styles = useCellStyles(index, drag, position);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={holdNode} style={[{ position: 'absolute', width: rect.width, height: rect.height, padding: INSET }, styles.cell]}>
        <Box flex={1}>
          <WidgetCard widget={widget} onMenu={openMenu} />
          <Animated.View style={[RING, { borderColor: link }, styles.ring]} />
        </Box>
      </Animated.View>
    </GestureDetector>
  );
}

export function DashboardGrid({ widgets }: { widgets: DashboardWidget[] }): React.ReactElement {
  const [width, setWidth] = useState(0);
  const [drops, setDrops] = useState(0);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const drag = useGridDrag();
  const columns = gridColumns(width);
  const layout = useMemo(() => packWidgets(widgets, columns), [widgets, columns]);
  const rects = useMemo(() => cellRects(layout, width), [layout, width]);
  const onDrop = useCallback((from: number, to: number) => {
    const moved = widgets[from];
    const target = widgets[to];
    if (moved !== undefined && target !== undefined) changeDashboard(list => moveWidget(list, moved.id, target.id));
    setDrops(count => count + 1);
  }, [widgets]);
  const measure = (event: LayoutChangeEvent): void => { setWidth(event.nativeEvent.layout.width); };
  const menuWidget = menu === null ? undefined : widgets.find(widget => widget.id === menu.id);
  return (
    <Box margin={{ x: PAGE_GUTTER - INSET, top: PAGE_GUTTER - INSET }} height={layout.rows * DASHBOARD_ROW} onLayout={measure}>
      {width === 0 ? null : widgets.map((widget, index) => {
        const rect = rects[index];
        return rect === undefined ? null : (
          <DashboardCell key={widget.id} widget={widget} index={index} rect={rect} rects={rects} drag={drag} drops={drops}
            onDrop={onDrop} onMenu={setMenu} />
        );
      })}
      {menu === null || menuWidget === undefined ? null : (
        <WidgetMenu widget={menuWidget} anchor={menu.anchor} onClose={() => { setMenu(null); }} />
      )}
    </Box>
  );
}
