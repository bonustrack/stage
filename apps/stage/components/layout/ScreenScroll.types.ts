import type { ScrollViewProps } from 'react-native';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import type { VirtualListHandle } from './VirtualList.types';

export type ScreenScrollHandle = Pick<VirtualListHandle, 'scrollToOffset'>;

export type ScreenScrollProps = Pick<
  ScrollViewProps,
  | 'style' | 'contentContainerStyle' | 'keyboardShouldPersistTaps' | 'children'
  | 'bounces' | 'alwaysBounceVertical' | 'overScrollMode' | 'nestedScrollEnabled'
  | 'onScroll' | 'onScrollBeginDrag' | 'onScrollEndDrag' | 'scrollEventThrottle'
> & { simultaneousHandlers?: SimultaneousRefs };
