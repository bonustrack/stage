import { forwardRef, useImperativeHandle, useRef, type ForwardedRef, type Ref } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import type { VirtualListHandle, VirtualListProps } from './VirtualList.types';

function nativeListProps<T>(props: VirtualListProps<T>): Omit<VirtualListProps<T>, 'scroll' | 'anchor' | 'estimatedItemSize' | 'stickToEnd'> {
  const { scroll, anchor, estimatedItemSize, stickToEnd, ...rest } = props;
  void scroll; void anchor; void estimatedItemSize; void stickToEnd;
  return rest;
}

function VirtualListInner<T>(props: VirtualListProps<T>, ref: ForwardedRef<VirtualListHandle>): React.ReactElement {
  const list = useRef<FlatList<T>>(null);
  useImperativeHandle(ref, () => ({
    scrollToOffset: (params) => { list.current?.scrollToOffset(params); },
    scrollToEnd: (params) => { list.current?.scrollToEnd(params); },
    scrollToIndex: (params) => { list.current?.scrollToIndex(params); },
    visibleAnchor: () => null,
    scrollToAnchor: () => false,
  }), []);
  return <FlatList<T> ref={list} {...nativeListProps(props)} />;
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => React.ReactElement;
