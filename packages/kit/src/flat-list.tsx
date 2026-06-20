
import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps,
} from 'react-native';

function FlatListInner<T>(
  props: FlatListProps<T>,
  ref: React.ForwardedRef<RNFlatList<T>>,
): React.ReactElement {
  return <RNFlatList<T> ref={ref} {...props} />;
}

export const FlatList = forwardRef(FlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.ForwardedRef<RNFlatList<T>> },
) => React.ReactElement;

export type { FlatListProps };
