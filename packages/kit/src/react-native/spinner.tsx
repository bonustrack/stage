import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { schemePalette } from '../tokens';
import { useKitScheme } from './theme-context';

export interface SpinnerProps {
  size?: number;
  color?: string;
}

const TURN_MS = 500;
const IS_WEB = Platform.OS === 'web';

const webSpin = StyleSheet.create({
  spin: {
    animationKeyframes: [{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }],
    animationDuration: `${TURN_MS}ms`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  } as ViewStyle,
});

function useNativeRotation(): Animated.AnimatedInterpolation<string> {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (IS_WEB) return;
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: TURN_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

function SpinnerRing({ size, color, gradientId }: { size: number; color: string; gradientId: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gradientId} x1="28.154%" y1="63.74%" x2="74.629%" y2="17.783%">
          <Stop stopColor={color} offset="0%" />
          <Stop stopColor={color} stopOpacity="0" offset="70%" />
        </LinearGradient>
      </Defs>
      <G transform="translate(2)" fill="none" fillRule="evenodd">
        <Circle stroke={`url(#${gradientId})`} strokeWidth={4} strokeLinecap="butt" cx={10} cy={12} r={10} />
        <Path d="M10 2C4.477 2 0 6.477 0 12" stroke={color} strokeWidth={4} strokeLinecap="butt" />
        <Rect x={8} y={0} width={4} height={4} rx={0} fill={color} />
      </G>
    </Svg>
  );
}

export function Spinner(props: SpinnerProps): React.ReactElement {
  const head = schemePalette(useKitScheme() === 'dark').head;
  const { size = 24, color = head } = props;
  const [gradientId] = useState(() => `kitSpin${Math.random().toString(36).slice(2, 8)}`);
  const rotate = useNativeRotation();
  const ring = <SpinnerRing size={size} color={color} gradientId={gradientId} />;

  if (IS_WEB) return <View style={[{ width: size, height: size }, webSpin.spin]}>{ring}</View>;
  return <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>{ring}</Animated.View>;
}
