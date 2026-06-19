/**
 * @file FlatList — a thin generic Kit wrapper over RN `FlatList` (full `FlatListProps<T>` passthrough with forwardRef) so call sites depend on one Kit primitive and the renderer can be swapped in one place.
 */

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

/** forwardRef erases the generic; re-cast so `<FlatList<T> .../>` keeps inferring the item type from `data`/`renderItem`. */
export const FlatList = forwardRef(FlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.ForwardedRef<RNFlatList<T>> },
) => React.ReactElement;

export type { FlatListProps };
