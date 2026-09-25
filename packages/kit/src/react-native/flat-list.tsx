
import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  Platform,
  type FlatListProps,
} from 'react-native';

const INDICATORS_BY_DEFAULT = Platform.OS === 'web';

function FlatListInner<T>(
  props: FlatListProps<T>,
  ref: React.ForwardedRef<RNFlatList<T>>,
): React.ReactElement {
  return (
    <RNFlatList<T>
      ref={ref}
      showsVerticalScrollIndicator={INDICATORS_BY_DEFAULT}
      showsHorizontalScrollIndicator={INDICATORS_BY_DEFAULT}
      {...props}
    />
  );
}

export const FlatList = forwardRef(FlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.ForwardedRef<RNFlatList<T>> },
) => React.ReactElement;

export type { FlatListProps };
