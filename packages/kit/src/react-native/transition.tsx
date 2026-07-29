
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

export interface TransitionProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Transition({ children, style }: TransitionProps): React.ReactElement {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
