/** @file Custom JS-only pull-to-refresh spinner and onScroll handlers for the Wallet Tokens list, rendered ourselves because RN's RefreshControl couldn't be reliably dismissed inside this nested-gesture ScrollView on Android. */

import { useEffect, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Box } from '../layout';
import { Spinner } from '../Spinner';

const THRESHOLD = 56; /** px of over-scroll past the top to arm a refresh */
const ACTIVE_OFFSET = 44; /** resting y of the spinner while refreshing */

export interface PullHandlers {
  /** Spinner overlay — render as the FIRST child of the ScrollView's content. */
  indicator: React.ReactElement;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

/** Provides pan handlers and an animated indicator for pull-to-refresh gestures. */
export function usePullToRefresh(
  refreshing: boolean,
  onRefresh: () => void,
  color: string,
): PullHandlers {
  /** Live pull distance (0..>THRESHOLD), drives the indicator before release. */
  const pull = useRef(new Animated.Value(0)).current;
  /** Most-negative contentOffset.y seen during the current drag. */
  const minY = useRef(0);
  /** Latch so one continuous over-scroll fires onRefresh at most once. */
  const armed = useRef(false);

  /** When refreshing flips on/off, animate the indicator to/from its active rest position; this is the sole visibility driver while running, so the spinner always animates away and never strands. */
  useEffect(() => {
    Animated.timing(pull, {
      toValue: refreshing ? ACTIVE_OFFSET : 0,
      duration: refreshing ? 120 : 180,
      useNativeDriver: true,
    }).start();
    if (!refreshing) armed.current = false;
  }, [refreshing, pull]);

  /** Handle the Scroll Begin Drag. */
  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    /** Reset the per-drag baseline using the drag-start offset, so a pull is measured relative to wherever the top sits — Android may clamp over-scroll at 0 and never report negative. */
    minY.current = e.nativeEvent.contentOffset.y;
  };

  /** Handle the Scroll. */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < minY.current) minY.current = y;
    if (refreshing) return; /** pinned to ACTIVE_OFFSET by the effect */
    /** Over-scroll distance (how far below the top, y<0, we've pulled) drives the indicator for live feedback. */
    const pulled = y < 0 ? -y : 0;
    pull.setValue(Math.min(pulled, THRESHOLD * 1.6));
    /** Arm during the drag the instant we cross the threshold rather than at release, because Android's negative offset is transient and onScrollEndDrag often misses it. */
    if (!armed.current && pulled >= THRESHOLD) {
      armed.current = true;
      onRefresh();
    }
  };

  /** Handle the Scroll End Drag. */
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const pulled = -Math.min(minY.current, e.nativeEvent.contentOffset.y);
    minY.current = 0;
    if (!refreshing && !armed.current && pulled >= THRESHOLD) {
      armed.current = true;
      onRefresh();
    } else if (!refreshing && !armed.current) {
      /** Released short of the threshold — relax the indicator back to hidden. */
      Animated.timing(pull, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    }
  };

  const opacity = pull.interpolate({
    inputRange: [0, THRESHOLD * 0.5, THRESHOLD],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });
  const translateY = pull.interpolate({
    inputRange: [0, THRESHOLD * 1.6],
    outputRange: [-8, ACTIVE_OFFSET],
    extrapolate: 'clamp',
  });
  const rotate = pull.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  const indicator = (
    <Box height={0} pointerEvents="none" align="center" style={{ zIndex: 10 }}>
      <Animated.View
        style={{
          position: 'absolute',
          opacity,
          transform: [{ translateY }, { rotate }],
        }}
>
        <Spinner size={24} color={color}/>
      </Animated.View>
    </Box>
  );

  return { indicator, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle: 16 };
}
