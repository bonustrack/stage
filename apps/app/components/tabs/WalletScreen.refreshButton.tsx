/** Tap-to-refresh icon button for the Wallet header (top-right). The reliable
 *  fallback to the pull-to-refresh gesture: a single tap fires the same
 *  `onRefresh` from useWalletBalances. While `refreshing` is true the glyph
 *  spins (JS-driven Animated loop) and the button is disabled so taps can't
 *  stack. Rendered inline as a right-slot action of the shared Topnav bar. */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';

export function RefreshButton({
  refreshing,
  onRefresh,
  color,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  color: string;
}): React.ReactElement {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={onRefresh}
      disabled={refreshing}
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: refreshing ? 0.5 : pressed ? 0.5 : 1,
      })}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon name="refresh" size={22} color={color} />
      </Animated.View>
    </Pressable>
  );
}
