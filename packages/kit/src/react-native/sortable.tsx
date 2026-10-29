import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { SortDirection, SortMove, SortRect, SortSlot } from '../sortable';
import {
  HandleContext,
  ListContext,
  ListsContext,
  PreviewContext,
  ScopeContext,
  isInPlace,
  useSortState,
  type ListContextValue,
  type SortTouchAction,
} from './sortable.context';
import { accessibilityProps, useKeyboard, usePan } from './sortable.gesture';
import { BodyLayer } from './body-layer';
import { setGrabCursor } from './sortable.platform';
import {
  makeSortCoordinator,
  type SortCoordinator,
  type SortIndicator,
  type SortItemEntry,
  type SortListEntry,
  type SortSource,
  type SortState,
} from './sortable.store';
import { useKitPalette } from './theme-context';

export type { SortDirection, SortMove } from '../sortable';
export type { SortTouchAction } from './sortable.context';
export type { SortIndicator, SortSource } from './sortable.store';

const DRAGGING_OPACITY = 0.4;
const GHOST_OPACITY = 0.9;
const COLLAPSED: ViewStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  overflow: 'hidden',
};

function Ghost({ coordinator }: { coordinator: SortCoordinator }): React.ReactElement | null {
  const drag = useSortState(coordinator, (state) => state.drag);
  if (drag === null || drag.keyboard || drag.inPlace) return null;
  const style: Animated.WithAnimatedValue<StyleProp<ViewStyle>> = {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1000,
    elevation: 8,
    opacity: GHOST_OPACITY,
    width: drag.size.width,
    height: drag.size.height,
    transform: coordinator.ghost.getTranslateTransform(),
  };
  return (
    <BodyLayer style={style}>
      <PreviewContext.Provider value>{drag.preview}</PreviewContext.Provider>
    </BodyLayer>
  );
}

function Placeholder({ coordinator }: { coordinator: SortCoordinator }): React.ReactElement {
  const preview = useSortState(coordinator, (state) => state.preview);
  return (
    <View pointerEvents="none" style={{ opacity: DRAGGING_OPACITY }}>
      <PreviewContext.Provider value>{preview}</PreviewContext.Provider>
    </View>
  );
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
        <Ghost coordinator={coordinator} />
      </View>
    </ScopeContext.Provider>
  );
}

export interface SortableListState {
  over: boolean;
  placeholder: ReactNode;
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
  indicator?: SortIndicator;
  touchAction?: SortTouchAction;
  accepts?: (move: SortMove) => boolean;
  placeAt?: (move: SortMove) => number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((state: SortableListState) => ReactNode);
}

function listStyle(direction: SortDirection, gap: number | undefined, style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  return [{ flexDirection: direction === 'vertical' ? 'column' : 'row', gap }, style];
}

function Indicator({ rect }: { rect: SortRect }): React.ReactElement {
  const palette = useKitPalette();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: 1,
        backgroundColor: palette.link,
      }}
    />
  );
}

function useListContext(value: ListContextValue): { context: ListContextValue; lists: ReadonlyMap<string, ListContextValue> } {
  const { coordinator, listId, group, direction, disabled, keyboard, indicator, touchAction, items } = value;
  const context = useMemo(
    () => ({ coordinator, listId, group, direction, disabled, keyboard, indicator, touchAction, items }),
    [coordinator, listId, group, direction, disabled, keyboard, indicator, touchAction, items],
  );
  const parents = useContext(ListsContext);
  const lists = useMemo(() => new Map([...parents, [listId, context]]), [parents, listId, context]);
  return { context, lists };
}

function listSettings(props: SortableListProps): Omit<ListContextValue, 'coordinator' | 'listId' | 'items'> {
  return {
    group: props.group ?? props.listId,
    direction: props.direction ?? 'vertical',
    disabled: props.disabled ?? false,
    keyboard: props.keyboard ?? true,
    indicator: props.indicator ?? 'preview',
    touchAction: props.touchAction ?? 'manipulation',
  };
}

const isEmptySlot = (slot: SortSlot | null, listId: string): boolean =>
  slot?.listId === listId && slot.beforeId === null && slot.afterId === null;

function ListBody(props: SortableListProps & { coordinator: SortCoordinator }): React.ReactElement {
  const { coordinator, listId } = props;
  const settings = listSettings(props);
  const { group, direction, indicator } = settings;
  const node = useRef<View>(null);
  const [items] = useState(() => new Map<string, SortItemEntry>());
  const latest = useRef(props);
  latest.current = props;
  useEffect(
    () =>
      coordinator.register(listId, (): SortListEntry => {
        const p = latest.current;
        return {
          listId,
          group,
          direction,
          label: p.label,
          itemIds: p.itemIds,
          payload: p.payload,
          indicator,
          placeAt: p.placeAt,
          node: () => node.current,
          items,
          accepts: (move) => !(p.disabled ?? false) && (p.accepts?.(move) ?? true),
          onMove: (move, source) => {
            p.onMove(move, source);
          },
        };
      }),
    [coordinator, listId, group, direction, indicator, items],
  );
  const over = useSortState(coordinator, (state) => state.target?.listId === listId);
  const line = useSortState(coordinator, (state) => (state.target?.listId === listId ? state.indicator : null));
  const empty = useSortState(coordinator, (state) => isEmptySlot(state.slot, listId));
  const { context, lists } = useListContext({ coordinator, listId, items, ...settings });
  const placeholder = empty ? <Placeholder coordinator={coordinator} /> : null;
  const custom = typeof props.children === 'function';
  return (
    <ListsContext.Provider value={lists}>
      <ListContext.Provider value={context}>
        <View ref={node} style={listStyle(direction, props.gap, props.style)}>
          {typeof props.children === 'function' ? props.children({ over, placeholder }) : props.children}
          {custom ? null : placeholder}
          {indicator === 'line' && line !== null ? <Indicator rect={line} /> : null}
        </View>
      </ListContext.Provider>
    </ListsContext.Provider>
  );
}

function PlainList({ direction = 'vertical', gap, style, children }: SortableListProps): React.ReactElement {
  return (
    <View style={listStyle(direction, gap, style)}>
      {typeof children === 'function' ? children({ over: false, placeholder: null }) : children}
    </View>
  );
}

function LiveList(props: SortableListProps): React.ReactElement {
  const scope = useContext(ScopeContext);
  if (scope !== null) return <ListBody {...props} coordinator={scope} />;
  return (
    <SortableScope>
      <Implicit {...props} />
    </SortableScope>
  );
}

export function SortableList(props: SortableListProps): React.ReactElement {
  return useContext(PreviewContext) ? <PlainList {...props} /> : <LiveList {...props} />;
}

function Implicit(props: SortableListProps): React.ReactElement {
  const scope = useContext(ScopeContext);
  if (scope === null) throw new Error('SortableScope is missing.');
  return <ListBody {...props} coordinator={scope} />;
}

export interface SortableItemProps {
  itemId: string;
  disabled?: boolean;
  handle?: boolean;
  follows?: string;
  listId?: string;
  onHold?: (point: { x: number; y: number }) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((state: { dragging: boolean }) => ReactNode);
}

interface ItemNode {
  node: React.RefObject<View | null>;
  read: () => unknown;
  offset: Animated.Value;
}

function useItemNode(list: ListContextValue, itemId: string, follows: string | undefined): ItemNode {
  const node = useRef<View>(null);
  const read = useMemo(() => () => node.current, []);
  const [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const item: SortItemEntry = { node: read, offset, follows };
    list.items.set(itemId, item);
    return () => {
      if (list.items.get(itemId) === item) list.items.delete(itemId);
    };
  }, [list, itemId, read, offset, follows]);
  return { node, read, offset };
}

function usePreview(children: SortableItemProps['children']): () => ReactNode {
  const latest = useRef(children);
  latest.current = children;
  return useMemo(
    () => () => {
      const current = latest.current;
      return typeof current === 'function' ? current({ dragging: false }) : current;
    },
    [],
  );
}

function itemStyle(
  list: ListContextValue,
  offset: Animated.Value,
  dragging: boolean,
  custom: boolean,
): Animated.WithAnimatedValue<ViewStyle> {
  const translate = list.direction === 'vertical' ? { translateY: offset } : { translateX: offset };
  if (isInPlace(list.indicator)) return { transform: [translate], zIndex: dragging ? 10 : 0 };
  return { transform: [translate], opacity: custom || !dragging ? 1 : DRAGGING_OPACITY };
}

const isHidden = (state: SortState, listId: string, itemId: string): boolean =>
  state.hidden.some((entry) => entry.listId === listId && entry.itemId === itemId);

function ItemView({
  list,
  lead,
  item,
  style,
  extra,
  children,
}: {
  list: ListContextValue;
  lead: string;
  item: ItemNode;
  style: StyleProp<ViewStyle>;
  extra?: object;
  children: SortableItemProps['children'];
}): React.ReactElement {
  const dragging = useSortState(list.coordinator, (state) => state.drag?.itemId === lead && state.drag.listId === list.listId);
  const hidden = useSortState(list.coordinator, (state) => isHidden(state, list.listId, lead));
  const custom = typeof children === 'function';
  return (
    <Animated.View ref={item.node} style={[itemStyle(list, item.offset, dragging, custom), style, hidden ? COLLAPSED : null]} {...extra}>
      {custom ? children({ dragging }) : children}
    </Animated.View>
  );
}

function slotSide(slot: SortSlot | null, listId: string, itemId: string): 'before' | 'after' | null {
  if (slot?.listId !== listId) return null;
  if (slot.afterId === itemId) return 'before';
  return slot.afterId === null && slot.beforeId === itemId ? 'after' : null;
}

function WithSlot({
  list,
  itemId,
  children,
}: {
  list: ListContextValue;
  itemId: string;
  children: React.ReactElement;
}): React.ReactElement {
  const side = useSortState(list.coordinator, (state) => slotSide(state.slot, list.listId, itemId));
  if (side === null) return children;
  const placeholder = <Placeholder coordinator={list.coordinator} />;
  return side === 'before' ? (
    <>
      {placeholder}
      {children}
    </>
  ) : (
    <>
      {children}
      {placeholder}
    </>
  );
}

function FollowerItem({
  list,
  itemId,
  follows,
  style,
  children,
}: {
  list: ListContextValue;
  itemId: string;
  follows: string;
  style: StyleProp<ViewStyle>;
  children: SortableItemProps['children'];
}): React.ReactElement {
  return (
    <ItemView list={list} lead={follows} item={useItemNode(list, itemId, follows)} style={style}>
      {children}
    </ItemView>
  );
}

function LeadItem({
  list,
  itemId,
  disabled = false,
  handle = false,
  onHold,
  style,
  children,
}: SortableItemProps & { list: ListContextValue }): React.ReactElement {
  const enabled = !disabled && !list.disabled;
  const item = useItemNode(list, itemId, undefined);
  const preview = usePreview(children);
  useEffect(() => {
    if (!handle) setGrabCursor(item.node.current, enabled);
  }, [item, handle, enabled]);
  useKeyboard(list, itemId, item.read, preview, enabled && list.keyboard && !handle);
  const pan = usePan(list, itemId, preview, onHold, enabled);
  const view = (
    <ItemView list={list} lead={itemId} item={item} style={style} extra={accessibilityProps(list, itemId, enabled)}>
      {children}
    </ItemView>
  );
  return (
    <WithSlot list={list} itemId={itemId}>
      {handle ? (
        <HandleContext.Provider value={{ pan, list, itemId, enabled, preview }}>{view}</HandleContext.Provider>
      ) : (
        <GestureDetector gesture={pan}>{view}</GestureDetector>
      )}
    </WithSlot>
  );
}

function LiveItem(props: SortableItemProps): React.ReactElement {
  const nearest = useContext(ListContext);
  const lists = useContext(ListsContext);
  const list = props.listId === undefined ? nearest : (lists.get(props.listId) ?? null);
  if (list === null) throw new Error('SortableItem must be inside its SortableList.');
  const { itemId, follows, style, children } = props;
  if (follows !== undefined)
    return (
      <FollowerItem list={list} itemId={itemId} follows={follows} style={style}>
        {children}
      </FollowerItem>
    );
  return <LeadItem {...props} list={list} />;
}

export function SortableItem(props: SortableItemProps): React.ReactElement {
  if (!useContext(PreviewContext)) return <LiveItem {...props} />;
  const { style, children } = props;
  return <View style={style}>{typeof children === 'function' ? children({ dragging: false }) : children}</View>;
}

export interface SortableHandleProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SortableHandle(props: SortableHandleProps): React.ReactElement {
  return useContext(PreviewContext) ? <View style={props.style}>{props.children}</View> : <LiveHandle {...props} />;
}

function LiveHandle({ children, style }: SortableHandleProps): React.ReactElement {
  const handle = useContext(HandleContext);
  if (handle === null) throw new Error('SortableHandle must be inside a SortableItem with handle.');
  const { pan, list, itemId, enabled, preview } = handle;
  const node = useRef<View>(null);
  const read = useMemo(() => () => node.current, []);
  useEffect(() => {
    setGrabCursor(node.current, enabled);
  }, [enabled]);
  useKeyboard(list, itemId, read, preview, enabled && list.keyboard);
  return (
    <GestureDetector gesture={pan}>
      <View ref={node} style={style}>
        {children}
      </View>
    </GestureDetector>
  );
}

export interface SortableTarget {
  itemId: string;
  listId: string;
  index: number;
}

const NO_SUBSCRIBE = (): (() => void) => () => undefined;

export function useSortableTarget(listId: string): SortableTarget | null {
  const scope = useContext(ScopeContext);
  const read = (): string => {
    const state = scope?.state();
    const target = state?.target;
    return state?.drag === null || state?.drag === undefined || target?.listId !== listId ? '' : `${state.drag.itemId}\n${target.index}`;
  };
  const key = useSyncExternalStore(scope?.subscribe ?? NO_SUBSCRIBE, read, read);
  return useMemo(() => {
    if (key === '') return null;
    const [itemId = '', index = '0'] = key.split('\n');
    return { itemId, listId, index: Number(index) };
  }, [key, listId]);
}

export function useSortableActive(): () => boolean {
  const scope = useContext(ScopeContext);
  return useMemo(() => () => scope?.state().drag != null, [scope]);
}
