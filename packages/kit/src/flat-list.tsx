/** FlatList - a thin Kit wrapper over RN `FlatList`. Not a ChatKit widget
 *  node; this is the Kit escape hatch from the Kit-only rollout so the app's
 *  raw `FlatList` call sites import one Kit primitive instead of `react-native`
 *  directly. Keeping the renderer here means a future swap (gesture-handler
 *  FlatList, virtualisation tweaks) is a one-file change.
 *
 *  Full `FlatListProps<T>` passthrough (incl. ref via forwardRef) - data,
 *  renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent,
 *  ListFooterComponent, onEndReached, contentContainerStyle, style, and every
 *  perf knob (initialNumToRender, windowSize, removeClippedSubviews, ...).
 *  Generic over the item type so call sites keep full type inference. */

import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps,
} from 'react-native';

/** Kit RN list surface. Generic over item type `T`. */
function FlatListInner<T>(
  props: FlatListProps<T>,
  ref: React.ForwardedRef<RNFlatList<T>>,
): React.ReactElement {
  return <RNFlatList<T> ref={ref} {...props} />;
}

/** forwardRef erases the generic; re-cast so `<FlatList<T> .../>` keeps
 *  inferring the item type from `data`/`renderItem`. */
export const FlatList = forwardRef(FlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.ForwardedRef<RNFlatList<T>> },
) => React.ReactElement;

export type { FlatListProps };
