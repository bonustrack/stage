/**
 * @file Custom JS-only pull-to-refresh spinner and onScroll handlers for the Wallet Tokens list.
 *  We render the spinner ourselves (bound to our own `refreshing` state + live pull distance) because RN's native
 *  RefreshControl could not be reliably dismissed inside this nested-gesture ScrollView on Android.
 */

import { useEffect, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Box } from '../layout';
import { Spinner } from '../Spinner';

const THRESHOLD = 56; // px of over-scroll past the top to arm a refresh
const ACTIVE_OFFSET = 44; // resting y of the spinner while refreshing

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

  // When refreshing flips on/off, animate the indicator to/from its active rest
  // position. This is the SOLE driver of visibility once a refresh is running,
  // so when `refreshing` clears the spinner always animates away — never strands.
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
    // Reset the per-drag latch/baseline. Use the offset at drag start as the
    // reference so a pull is measured RELATIVE to wherever the top sits — on
    // Android the over-scroll contentOffset.y may clamp at 0 and never report
    // negative, so we can't rely on an absolute negative value alone.
    minY.current = e.nativeEvent.contentOffset.y;
  };

  /** Handle the Scroll. */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < minY.current) minY.current = y;
    if (refreshing) return; // pinned to ACTIVE_OFFSET by the effect
    // Over-scroll distance: how far below the top (y<0, iOS bounce / Android
    // overscroll) we've pulled. Drive the indicator for live feedback.
    const pulled = y < 0 ? -y : 0;
    pull.setValue(Math.min(pulled, THRESHOLD * 1.6));
    // Arm DURING the drag the instant we cross the threshold — don't wait for
    // release. On Android the negative offset is transient (the scroller snaps
    // back fast), so reading it at onScrollEndDrag often misses it entirely.
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
      // Released short of the threshold — relax the indicator back to hidden.
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
