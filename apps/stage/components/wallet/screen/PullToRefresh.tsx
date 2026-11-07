import { useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const THRESHOLD = 56;

export interface PullHandlers {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

export function usePullToRefresh(refreshing: boolean, onRefresh: () => void): PullHandlers {
  const minY = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    if (!refreshing) armed.current = false;
  }, [refreshing]);

  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    minY.current = e.nativeEvent.contentOffset.y;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < minY.current) minY.current = y;
    if (refreshing || armed.current || -y < THRESHOLD) return;
    armed.current = true;
    onRefresh();
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const pulled = -Math.min(minY.current, e.nativeEvent.contentOffset.y);
    minY.current = 0;
    if (refreshing || armed.current || pulled < THRESHOLD) return;
    armed.current = true;
    onRefresh();
  };

  return { onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle: 16 };
}
