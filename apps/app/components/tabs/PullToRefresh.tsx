/** Custom JS-only pull-to-refresh for the Wallet Tokens list.
 *
 *  WHY: RN's native `RefreshControl`, when fed a controlled `refreshing` prop
 *  inside this nested-gesture ScrollView (RNGH ScrollView declared simultaneous
 *  with the horizontal pager Pan), did NOT reliably dismiss its native spinner
 *  on Android — flipping `refreshing` false left the comet stranded. Three
 *  prior fixes (public-only fetch, timer dismiss, try/finally + race, ScrollView
 *  swap + remount key) all failed because the stranded element is the NATIVE
 *  control, not our state.
 *
 *  FIX: render the spinner OURSELVES. Visibility is bound solely to our own
 *  `refreshing` state (which is guaranteed to clear via try/finally + 8s
 *  hardStop in WalletScreen.balances.ts) plus the live pull distance. Because we
 *  draw and hide it, it can never get wedged by the native layer.
 *
 *  MECHANISM (pure onScroll, no extra PanGestureHandler so it never competes
 *  with the pager pan): we read `contentOffset.y` on scroll. On iOS bounce y
 *  goes negative on over-scroll; on Android (overScrollMode) the value can also
 *  dip below 0, but to be robust we ALSO track the most-negative y seen during
 *  the active drag and treat the release (`onScrollEndDrag`) as the trigger:
 *  if the user pulled past `THRESHOLD` and lets go, we fire `onRefresh`. The
 *  spinner's opacity/translate track the pull distance for live feedback, then
 *  snap to a fixed "active" position while `refreshing` is true, and animate
 *  out the instant `refreshing` flips false. */

import { useEffect, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Box } from '../layout';
import { Spinner } from '../Spinner';

const THRESHOLD = 70; // px of over-scroll past the top to arm a refresh
const ACTIVE_OFFSET = 44; // resting y of the spinner while refreshing

export interface PullHandlers {
  /** Spinner overlay — render as the FIRST child of the ScrollView's content. */
  indicator: React.ReactElement;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < minY.current) minY.current = y;
    if (refreshing) return; // pinned to ACTIVE_OFFSET by the effect
    // Map over-scroll (y < 0) to a damped pull distance for live feedback.
    const dist = y < 0 ? Math.min(-y, THRESHOLD * 1.6) : 0;
    pull.setValue(dist);
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const pulled = -Math.min(minY.current, e.nativeEvent.contentOffset.y);
    minY.current = 0;
    if (!refreshing && !armed.current && pulled >= THRESHOLD) {
      armed.current = true;
      onRefresh();
    } else if (!refreshing) {
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
    <Box pointerEvents="none" style={{ height: 0, alignItems: 'center', zIndex: 10 }}>
      <Animated.View
        style={{
          position: 'absolute',
          opacity,
          transform: [{ translateY }, { rotate }],
        }}
      >
        <Spinner size={24} color={color} />
      </Animated.View>
    </Box>
  );

  return { indicator, onScroll, onScrollEndDrag, scrollEventThrottle: 16 };
}
