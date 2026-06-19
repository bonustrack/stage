/**
 * @file Tap-to-refresh icon button for the Wallet header that fires onRefresh and spins its glyph (disabled) while a refresh is in flight.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';

/** Button that triggers a wallet refresh and spins while refreshing. */
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
    return () => { loop.stop(); };
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
