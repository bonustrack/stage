
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Box } from './layout';

const CSS_SPIN = { dataSet: { stagespin: '1' } };

function useSpinRotation(): Animated.AnimatedInterpolation<string> {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    anim.start();
    return () => { anim.stop(); };
  }, [spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

export function Spinner({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  const gid = useRef(`metroSpin${Math.random().toString(36).slice(2, 8)}`).current;
  const rotate = useSpinRotation();
  const Wrapper = Platform.OS === 'web' ? Box : Animated.View;
  const wrapperStyle = Platform.OS === 'web'
    ? { width: size, height: size }
    : { width: size, height: size, transform: [{ rotate }] };

  return (
    <Wrapper style={wrapperStyle} {...(Platform.OS === 'web' ? CSS_SPIN : {})}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={gid} x1="28.154%" y1="63.74%" x2="74.629%" y2="17.783%">
            <Stop stopColor={color} offset="0%" />
            {}
            <Stop stopColor={color} stopOpacity="0" offset="70%" />
          </LinearGradient>
        </Defs>
        <G transform="translate(2)" fill="none" fillRule="evenodd">
          <Circle stroke={`url(#${gid})`} strokeWidth={4} strokeLinecap="butt" cx={10} cy={12} r={10} />
          <Path d="M10 2C4.477 2 0 6.477 0 12" stroke={color} strokeWidth={4} strokeLinecap="butt" />
          {}
          <Rect x={8} y={0} width={4} height={4} rx={0} fill={color} />
        </G>
      </Svg>
    </Wrapper>
  );
}
