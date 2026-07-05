
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface SpinnerProps {
  size?: number;
  color?: string;
}

const AnimatedView = Animated.View;

export function Spinner(props: SpinnerProps): React.ReactElement {
  const { size = 24, color = '#888888' } = props;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const stroke = Math.max(2, Math.round(size / 10));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <AnimatedView style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeOpacity={0.2}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.25} ${c}`}
            fill="none"
          />
        </Svg>
      </AnimatedView>
    </View>
  );
}
