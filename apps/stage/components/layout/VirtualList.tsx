import { forwardRef, useImperativeHandle, useRef, type ForwardedRef, type Ref } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import type { VirtualListHandle, VirtualListProps } from './VirtualList.types';
import { withPersistedScroll } from './VirtualList.persist';

function nativeListProps<T>(
  props: VirtualListProps<T>,
): Omit<VirtualListProps<T>, 'scroll' | 'anchor' | 'estimatedItemSize' | 'stickToEnd' | 'persist'> {
  const { scroll, anchor, estimatedItemSize, stickToEnd, persist, ...rest } = withPersistedScroll(props);
  void scroll;
  void anchor;
  void estimatedItemSize;
  void stickToEnd;
  void persist;
  return rest;
}

function VirtualListInner<T>(props: VirtualListProps<T>, ref: ForwardedRef<VirtualListHandle>): React.ReactElement {
  const list = useRef<FlatList<T>>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToOffset: (params) => {
        list.current?.scrollToOffset(params);
      },
      scrollToEnd: (params) => {
        list.current?.scrollToEnd(params);
      },
      scrollToIndex: (params) => {
        list.current?.scrollToIndex(params);
      },
      visibleAnchor: () => null,
      scrollToAnchor: () => false,
    }),
    [],
  );
  return <FlatList<T> ref={list} showsVerticalScrollIndicator={false} {...nativeListProps(props)} />;
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => React.ReactElement;
