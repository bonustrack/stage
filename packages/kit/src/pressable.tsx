/**
 * @file Pressable — a thin Kit wrapper over RN `Pressable` for non-Button tap targets, with full `PressableProps` passthrough plus a `pressedOpacity` shorthand for dim-on-press.
 */

import { Pressable as RNPressable, type PressableProps, type ViewStyle } from 'react-native';

export interface KitPressableProps extends PressableProps {
  /** Opacity applied while pressed (0-1). Default 1 (no dim). Composes with `style`. Pass e.g. 0.6 for the common "dim on press" feedback. */
  pressedOpacity?: number;
}

/** Kit RN pressable. */
export function Pressable(props: KitPressableProps): React.ReactElement {
  const { pressedOpacity, style, children, ...rest } = props;

  if (pressedOpacity === undefined) {
    return (
      <RNPressable style={style} {...rest}>
        {children}
      </RNPressable>
    );
  }

  return (
    <RNPressable
      style={(state) => {
        const dim: ViewStyle = { opacity: state.pressed ? pressedOpacity : 1 };
        const base = typeof style === 'function' ? style(state) : style;
        return base ? ([dim, base].flat()) : dim;
      }}
      {...rest}
    >
      {children}
    </RNPressable>
  );
}
