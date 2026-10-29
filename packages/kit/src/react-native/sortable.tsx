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
  useSortState,
  type ListContextValue,
  type SortTouchAction,
} from './sortable.context';
import { useKeyboard } from './sortable.gesture';
import { BodyLayer } from './body-layer';
import { LiveItem, Placeholder, type SortableItemProps } from './sortable.item';
import { setGrabCursor } from './sortable.platform';
import {
  makeSortCoordinator,
  type SortCoordinator,
  type SortIndicator,
  type SortItemEntry,
  type SortListEntry,
  type SortSource,
} from './sortable.store';
import { useKitPalette } from './theme-context';

export type { SortDirection, SortMove } from '../sortable';
export type { SortTouchAction } from './sortable.context';
export type { SortableItemProps } from './sortable.item';
export type { SortIndicator, SortSource } from './sortable.store';

const GHOST_OPACITY = 0.9;

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
