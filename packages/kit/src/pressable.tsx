/** Pressable - a thin Kit wrapper over RN `Pressable`. Not a ChatKit widget
 *  node (ChatKit interactivity is server-driven `onClickAction`); this is the
 *  Kit escape hatch from objective 2 of the port plan so the app's ~72 raw
 *  `Pressable` call sites that are NOT a Button (rows, avatars, custom tap
 *  targets) import one Kit primitive instead of `react-native`. Use Kit
 *  `Button` for actual buttons; use this for everything-else-tappable.
 *
 *  Full `PressableProps` passthrough, plus a `pressedOpacity` ergonomic
 *  shorthand (the most common pattern: dim slightly on press) so call sites
 *  stop hand-rolling the `style={({ pressed }) => ...}` callback. When set, it
 *  composes with any `style` the caller passes. */

import { Pressable as RNPressable, type PressableProps, type ViewStyle } from 'react-native';

export interface KitPressableProps extends PressableProps {
  /** Opacity applied while pressed (0-1). Default 1 (no dim). Composes with
   *  `style`. Pass e.g. 0.6 for the common "dim on press" feedback. */
  pressedOpacity?: number;
}

/** Kit RN pressable. */
export function Pressable(props: KitPressableProps): React.ReactElement {
  const { pressedOpacity, style, children, ...rest } = props;

  if (pressedOpacity === undefined) {
    return (
      <RNPressable style={style} {...rest}>
        {children as PressableProps['children']}
      </RNPressable>
    );
  }

  return (
    <RNPressable
      style={(state) => {
        const dim: ViewStyle = { opacity: state.pressed ? pressedOpacity : 1 };
        const base = typeof style === 'function' ? style(state) : style;
        return base ? ([dim, base].flat() as ViewStyle[]) : dim;
      }}
      {...rest}
    >
      {children as PressableProps['children']}
    </RNPressable>
  );
}
