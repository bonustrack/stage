
import { useEffect, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Box } from '../layout';
import { Spinner } from '../Spinner';

const THRESHOLD = 56;
const ACTIVE_OFFSET = 44;

export interface PullHandlers {
  indicator: React.ReactElement;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

export function usePullToRefresh(
  refreshing: boolean,
  onRefresh: () => void,
  color: string,
): PullHandlers {
  const pull = useRef(new Animated.Value(0)).current;
  const minY = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    Animated.timing(pull, {
      toValue: refreshing ? ACTIVE_OFFSET : 0,
      duration: refreshing ? 120 : 180,
      useNativeDriver: true,
    }).start();
    if (!refreshing) armed.current = false;
  }, [refreshing, pull]);

  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    minY.current = e.nativeEvent.contentOffset.y;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < minY.current) minY.current = y;
    if (refreshing) return;
    const pulled = y < 0 ? -y : 0;
    pull.setValue(Math.min(pulled, THRESHOLD * 1.6));
    if (!armed.current && pulled >= THRESHOLD) {
      armed.current = true;
      onRefresh();
    }
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const pulled = -Math.min(minY.current, e.nativeEvent.contentOffset.y);
    minY.current = 0;
    if (!refreshing && !armed.current && pulled >= THRESHOLD) {
      armed.current = true;
      onRefresh();
    } else if (!refreshing && !armed.current) {
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
