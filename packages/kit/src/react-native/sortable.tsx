import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import type { SortDirection, SortMove, SortRect, SortStep } from '../sortable';
import { isTouchPointer, listenKeys, setGrabCursor, suppressNextClick } from './sortable.platform';
import { makeSortCoordinator, type SortCoordinator, type SortListEntry, type SortSource, type SortState } from './sortable.store';
import { useKitPalette } from './theme-context';

export type { SortDirection, SortMove } from '../sortable';
export type { SortSource } from './sortable.store';

const HOLD_MS = 250;
const MOVE_SLOP = 6;
const DRAGGING_OPACITY = 0.4;
const GHOST_OPACITY = 0.9;
const EMPTY_DROP_AREA = 40;
const EMPTY: Record<SortDirection, ViewStyle> = { vertical: { minHeight: EMPTY_DROP_AREA }, horizontal: { minWidth: EMPTY_DROP_AREA } };
const SORT_STEPS: readonly SortStep[] = ['backward', 'forward', 'previousList', 'nextList'];

interface ListContextValue {
  coordinator: SortCoordinator;
  listId: string;
  group: string;
  direction: SortDirection;
  disabled: boolean;
  keyboard: boolean;
  items: Map<string, () => unknown>;
}

const ScopeContext = createContext<SortCoordinator | null>(null);
const PreviewContext = createContext(false);
const ListContext = createContext<ListContextValue | null>(null);
interface HandleValue { pan: PanGesture; list: ListContextValue; itemId: string; enabled: boolean }

const HandleContext = createContext<HandleValue | null>(null);

function useSortState<T>(coordinator: SortCoordinator, select: (state: SortState) => T): T {
  return useSyncExternalStore(coordinator.subscribe, () => select(coordinator.state()), () => select(coordinator.state()));
}

function Ghost({ coordinator }: { coordinator: SortCoordinator }): React.ReactElement | null {
  const drag = useSortState(coordinator, state => state.drag);
  if (drag === null || drag.keyboard) return null;
  const style: Animated.WithAnimatedValue<StyleProp<ViewStyle>> = {
    position: 'absolute', left: 0, top: 0, zIndex: 1000, elevation: 8, opacity: GHOST_OPACITY,
    width: drag.size.width, height: drag.size.height, transform: coordinator.ghost.getTranslateTransform(),
  };
  return <Animated.View pointerEvents="none" style={style}><PreviewContext.Provider value>{drag.preview}</PreviewContext.Provider></Animated.View>;
}

export interface SortableScopeProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SortableScope({ children, style }: SortableScopeProps): React.ReactElement {
  const [coordinator] = useState(makeSortCoordinator);
  const node = useRef<View>(null);
  coordinator.setScope(() => node.current);
  return (
    <ScopeContext.Provider value={coordinator}>
      <View ref={node} style={style}>
        {children}
        <Ghost coordinator={coordinator}/>
      </View>
    </ScopeContext.Provider>
  );
}

export interface SortableListProps {
  listId: string;
  itemIds: readonly string[];
  onMove: (move: SortMove, source: SortSource) => void;
  group?: string;
  direction?: SortDirection;
  gap?: number;
  label?: string;
  payload?: unknown;
  disabled?: boolean;
  keyboard?: boolean;
  indicator?: 'line' | 'none';
  accepts?: (move: SortMove) => boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((state: { over: boolean }) => ReactNode);
}

function listStyle(direction: SortDirection, gap: number | undefined, empty: boolean, style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  return [{ flexDirection: direction === 'vertical' ? 'column' : 'row', gap }, empty ? EMPTY[direction] : null, style];
}

function Indicator({ rect }: { rect: SortRect }): React.ReactElement {
  const palette = useKitPalette();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: 1, backgroundColor: palette.link }}
    />
  );
}

function ListBody(props: SortableListProps & { coordinator: SortCoordinator }): React.ReactElement {
  const { coordinator, listId, group = listId, direction = 'vertical', gap, disabled = false, keyboard = true, indicator = 'line' } = props;
  const node = useRef<View>(null);
  const [items] = useState(() => new Map<string, () => unknown>());
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => coordinator.register(listId, (): SortListEntry => {
    const p = latest.current;
    return {
      listId, group, direction, label: p.label, itemIds: p.itemIds, payload: p.payload,
      node: () => node.current, itemNode: id => items.get(id)?.() ?? null,
      accepts: move => !(p.disabled ?? false) && (p.accepts?.(move) ?? true),
      onMove: (move, source) => { p.onMove(move, source); },
    };
  }), [coordinator, listId, group, direction, items]);
  const over = useSortState(coordinator, state => state.target?.listId === listId);
  const line = useSortState(coordinator, state => (state.target?.listId === listId ? state.indicator : null));
  const context = useMemo(
    () => ({ coordinator, listId, group, direction, disabled, keyboard, items }),
    [coordinator, listId, group, direction, disabled, keyboard, items],
  );
  const body = typeof props.children === 'function' ? props.children({ over }) : props.children;
  return (
    <ListContext.Provider value={context}>
      <View ref={node} style={listStyle(direction, gap, props.itemIds.length === 0, props.style)}>
        {body}
        {indicator === 'line' && line !== null ? <Indicator rect={line}/> : null}
      </View>
    </ListContext.Provider>
  );
}

function PlainList({ direction = 'vertical', gap, style, children }: SortableListProps): React.ReactElement {
  return (
    <View style={listStyle(direction, gap, false, style)}>
      {typeof children === 'function' ? children({ over: false }) : children}
    </View>
  );
}

function LiveList(props: SortableListProps): React.ReactElement {
  const scope = useContext(ScopeContext);
  if (scope !== null) return <ListBody {...props} coordinator={scope}/>;
  return <SortableScope><Implicit {...props}/></SortableScope>;
}

export function SortableList(props: SortableListProps): React.ReactElement {
  return useContext(PreviewContext) ? <PlainList {...props}/> : <LiveList {...props}/>;
}

function Implicit(props: SortableListProps): React.ReactElement {
  const scope = useContext(ScopeContext);
  if (scope === null) throw new Error('SortableScope is missing.');
  return <ListBody {...props} coordinator={scope}/>;
}

const KEY_STEPS: Record<SortDirection, Record<string, SortStep>> = {
  vertical: { ArrowUp: 'backward', ArrowDown: 'forward', ArrowLeft: 'previousList', ArrowRight: 'nextList' },
  horizontal: { ArrowLeft: 'backward', ArrowRight: 'forward', ArrowUp: 'previousList', ArrowDown: 'nextList' },
};

function useKeyboard(list: ListContextValue, itemId: string, node: () => unknown, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const { coordinator, listId, direction } = list;
    return listenKeys(node(), (key) => {
      const lifted = coordinator.state().drag?.itemId === itemId && coordinator.state().drag?.keyboard === true;
      const step = KEY_STEPS[direction][key];
      if (key === ' ' || key === 'Enter') { if (lifted) coordinator.keyDrop(); else coordinator.keyLift(listId, itemId); return true; }
      if (!lifted) return false;
      if (key === 'Escape') { coordinator.keyCancel(); return true; }
      if (step !== undefined) { coordinator.keyStep(step); return true; }
      return false;
    });
  }, [list, itemId, node, enabled]);
}

function accessibilityActions(list: ListContextValue): { name: SortStep; label: string }[] {
  const along = list.direction === 'vertical' ? ['Move up', 'Move down'] : ['Move left', 'Move right'];
  const base: { name: SortStep; label: string }[] = [{ name: 'backward', label: along[0] ?? '' }, { name: 'forward', label: along[1] ?? '' }];
  if (list.coordinator.groupSize(list.group) < 2) return base;
  return [...base, { name: 'previousList', label: 'Move to previous list' }, { name: 'nextList', label: 'Move to next list' }];
}

function usePan(list: ListContextValue, itemId: string, preview: () => ReactNode, onHold: ((point: { x: number; y: number }) => void) | undefined, enabled: boolean): PanGesture {
  const touch = isTouchPointer();
  return useMemo(() => {
    const { coordinator, listId } = list;
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(enabled)
      .onBegin((e) => { coordinator.press({ x: e.absoluteX, y: e.absoluteY }); })
      .onStart((e) => {
        coordinator.begin(listId, itemId, preview());
        coordinator.move({ x: e.absoluteX, y: e.absoluteY });
      })
      .onUpdate((e) => { coordinator.move({ x: e.absoluteX, y: e.absoluteY }); })
      .onEnd((e, success) => {
        const moved = coordinator.wasMoved();
        if (!success) { coordinator.cancel(); return; }
        coordinator.drop();
        if (moved || !touch || onHold === undefined) return;
        suppressNextClick();
        onHold({ x: e.absoluteX, y: e.absoluteY });
      })
      .onFinalize(() => {
        const drag = coordinator.state().drag;
        if (drag?.itemId === itemId && !drag.keyboard) coordinator.cancel();
      });
    if (touch) pan.activateAfterLongPress(HOLD_MS);
    else pan.minDistance(MOVE_SLOP);
    pan.config.touchAction = 'manipulation';
    return pan;
  }, [list, itemId, preview, onHold, enabled, touch]);
}

export interface SortableItemProps {
  itemId: string;
  disabled?: boolean;
  handle?: boolean;
  onHold?: (point: { x: number; y: number }) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((state: { dragging: boolean }) => ReactNode);
}

function useItemNode(list: ListContextValue, itemId: string): { node: React.RefObject<View | null>; read: () => unknown } {
  const node = useRef<View>(null);
  const read = useMemo(() => () => node.current, []);
  useEffect(() => {
    list.items.set(itemId, read);
    return () => { if (list.items.get(itemId) === read) list.items.delete(itemId); };
  }, [list, itemId, read]);
  return { node, read };
}

function usePreview(children: SortableItemProps['children']): () => ReactNode {
  const latest = useRef(children);
  latest.current = children;
  return useMemo(() => () => {
    const current = latest.current;
    return typeof current === 'function' ? current({ dragging: false }) : current;
  }, []);
}

function accessibilityProps(list: ListContextValue, itemId: string, enabled: boolean) {
  if (!enabled || !list.keyboard) return {};
  return {
    accessibilityActions: accessibilityActions(list),
    onAccessibilityAction: (event: AccessibilityActionEvent): void => {
      const step = SORT_STEPS.find(name => name === event.nativeEvent.actionName);
      if (step !== undefined) list.coordinator.moveBy(list.listId, itemId, step);
    },
  };
}

function ItemView({ list, itemId, enabled, node, style, children }: {
  list: ListContextValue; itemId: string; enabled: boolean; node: React.RefObject<View | null>;
  style: StyleProp<ViewStyle>; children: SortableItemProps['children'];
}): React.ReactElement {
  const dragging = useSortState(list.coordinator, state => state.drag?.itemId === itemId && state.drag.listId === list.listId);
  const custom = typeof children === 'function';
  return (
    <View ref={node} style={[custom ? null : { opacity: dragging ? DRAGGING_OPACITY : 1 }, style]} {...accessibilityProps(list, itemId, enabled)}>
      {custom ? children({ dragging }) : children}
    </View>
  );
}

function LiveItem({ itemId, disabled = false, handle = false, onHold, style, children }: SortableItemProps): React.ReactElement {
  const list = useContext(ListContext);
  if (list === null) throw new Error('SortableItem must be inside a SortableList.');
  const enabled = !disabled && !list.disabled;
  const { node, read } = useItemNode(list, itemId);
  useEffect(() => { if (!handle) setGrabCursor(node.current, enabled); }, [node, handle, enabled]);
  useKeyboard(list, itemId, read, enabled && list.keyboard && !handle);
  const pan = usePan(list, itemId, usePreview(children), onHold, enabled);
  const view = <ItemView list={list} itemId={itemId} enabled={enabled} node={node} style={style}>{children}</ItemView>;
  if (handle) return <HandleContext.Provider value={{ pan, list, itemId, enabled }}>{view}</HandleContext.Provider>;
  return <GestureDetector gesture={pan}>{view}</GestureDetector>;
}

export function SortableItem(props: SortableItemProps): React.ReactElement {
  if (!useContext(PreviewContext)) return <LiveItem {...props}/>;
  const { style, children } = props;
  return <View style={style}>{typeof children === 'function' ? children({ dragging: false }) : children}</View>;
}

export interface SortableHandleProps { children: ReactNode; style?: StyleProp<ViewStyle> }

export function SortableHandle(props: SortableHandleProps): React.ReactElement {
  return useContext(PreviewContext) ? <View style={props.style}>{props.children}</View> : <LiveHandle {...props}/>;
}

function LiveHandle({ children, style }: SortableHandleProps): React.ReactElement {
  const handle = useContext(HandleContext);
  if (handle === null) throw new Error('SortableHandle must be inside a SortableItem with handle.');
  const { pan, list, itemId, enabled } = handle;
  const node = useRef<View>(null);
  const read = useMemo(() => () => node.current, []);
  useEffect(() => { setGrabCursor(node.current, enabled); }, [enabled]);
  useKeyboard(list, itemId, read, enabled && list.keyboard);
  return <GestureDetector gesture={pan}><View ref={node} style={style}>{children}</View></GestureDetector>;
}
