import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { SortSlot } from '../sortable';
import {
  HandleContext,
  ListContext,
  ListsContext,
  PreviewContext,
  isInPlace,
  useSortState,
  type ListContextValue,
} from './sortable.context';
import { accessibilityProps, useKeyboard, usePan } from './sortable.gesture';
import { setGrabCursor } from './sortable.platform';
import type { SortCoordinator, SortItemEntry, SortState } from './sortable.store';

const DRAGGING_OPACITY = 0.4;

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

export function Placeholder({ coordinator }: { coordinator: SortCoordinator }): React.ReactElement {
  const preview = useSortState(coordinator, (state) => state.preview);
  return (
    <View pointerEvents="none" style={{ opacity: DRAGGING_OPACITY }}>
      <PreviewContext.Provider value>{preview}</PreviewContext.Provider>
    </View>
  );
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

export function LiveItem(props: SortableItemProps): React.ReactElement {
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
