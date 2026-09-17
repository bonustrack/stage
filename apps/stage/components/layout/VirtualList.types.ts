import type { FlatListProps } from 'react-native';
import type { SimultaneousRefs } from '../SwipeTabs.types';

type SharedFlatListProps<T> = Pick<
  FlatListProps<T>,
  | 'data' | 'renderItem' | 'keyExtractor' | 'extraData'
  | 'ListHeaderComponent' | 'ListFooterComponent' | 'ListEmptyComponent'
  | 'style' | 'contentContainerStyle'
  | 'onEndReached' | 'onEndReachedThreshold' | 'onStartReached' | 'onStartReachedThreshold'
  | 'onScroll' | 'scrollEventThrottle' | 'onScrollBeginDrag' | 'onContentSizeChange' | 'onLayout'
  | 'inverted' | 'initialScrollIndex' | 'initialNumToRender' | 'windowSize' | 'maxToRenderPerBatch'
  | 'removeClippedSubviews' | 'maintainVisibleContentPosition' | 'onScrollToIndexFailed'
  | 'showsVerticalScrollIndicator' | 'keyboardShouldPersistTaps' | 'keyboardDismissMode'
>;

export type ListScrollMode = 'window' | 'self';

export interface VirtualListProps<T> extends SharedFlatListProps<T> {
  simultaneousHandlers?: SimultaneousRefs;
  scroll?: ListScrollMode;
  anchor?: 'start' | 'end';
  estimatedItemSize?: number;
  stickToEnd?: () => boolean;
}

export interface ListAnchor { key: string; offset: number }

export interface VirtualListHandle {
  scrollToOffset(params: { offset: number; animated?: boolean }): void;
  scrollToEnd(params?: { animated?: boolean }): void;
  scrollToIndex(params: { index: number; animated?: boolean; viewPosition?: number }): void;
  visibleAnchor(): ListAnchor | null;
  scrollToAnchor(anchor: ListAnchor): boolean;
}
