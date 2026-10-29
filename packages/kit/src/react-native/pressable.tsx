import { Pressable as RNPressable, type PressableProps, type ViewStyle } from 'react-native';

export interface KitPressableProps extends PressableProps {
  pressedOpacity?: number;
}

export function Pressable(props: KitPressableProps): React.ReactElement {
  const { pressedOpacity, style, children, ...rest } = props;
  return (
    <RNPressable
      style={
        pressedOpacity === undefined
          ? style
          : (state) => {
              const dim: ViewStyle = { opacity: state.pressed ? pressedOpacity : 1 };
              const base = typeof style === 'function' ? style(state) : style;
              return base ? [dim, base].flat() : dim;
            }
      }
      {...rest}
    >
      {children}
    </RNPressable>
  );
}
