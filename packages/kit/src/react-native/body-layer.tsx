import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { liftToBody } from './sortable.platform';

const OUT_OF_FLOW: ViewStyle = { position: 'absolute', left: 0, top: 0 };

export function BodyLayer({ style, children }: { style: Animated.WithAnimatedValue<StyleProp<ViewStyle>>; children: ReactNode }): React.ReactElement {
  const layer = useRef<View>(null);
  useLayoutEffect(() => liftToBody(layer.current), []);
  return (
    <View pointerEvents="none" style={OUT_OF_FLOW}>
      <Animated.View ref={layer} pointerEvents="none" style={style}>{children}</Animated.View>
    </View>
  );
}
