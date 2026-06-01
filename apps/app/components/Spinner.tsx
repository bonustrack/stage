/** Loading spinner mirroring @snapshot-labs/tune's UiLoading (the sx-monorepo
 *  spinner) so the mobile app matches the web: a rotating comet — a
 *  gradient-stroked circle + a solid leading arc. */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function Spinner({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const gid = useRef(`metroSpin${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={gid} x1="28.154%" y1="63.74%" x2="74.629%" y2="17.783%">
            <Stop stopColor={color} offset="0%" />
            <Stop stopColor={color} stopOpacity="0" offset="100%" />
          </LinearGradient>
        </Defs>
        <G transform="translate(2)" fill="none" fillRule="evenodd">
          <Circle stroke={`url(#${gid})`} strokeWidth={4} strokeLinecap="butt" cx={10} cy={12} r={10} />
          <Path d="M10 2C4.477 2 0 6.477 0 12" stroke={color} strokeWidth={4} strokeLinecap="butt" />
          <Rect x={8} width={4} height={4} rx={0} fill={color} />
        </G>
      </Svg>
    </Animated.View>
  );
}
