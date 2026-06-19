/** Divider - a ChatKit-styled separator line. Mirrors ChatKit's `Divider`
 *  widget; deviation: `dark` boolean (kit is hook-free). A border-token hairline
 *  with symmetric vertical `spacing`; `flush` spans edge-to-edge via a negative
 *  margin escape from a 16px-padded container. `size` overrides thickness. */

import { View, type ViewStyle } from 'react-native';

export interface DividerProps {
  /** ChatKit: spacing. Symmetric vertical margin around the line, px. Default 0. */
  spacing?: number;
  /** ChatKit: color. Token/hex; falls back to the scheme border color. */
  color?: string;
  /** ChatKit: size. Line thickness in px. Default 1 (hairline). */
  size?: number;
  /** ChatKit: flush. Ignore the container's horizontal padding (full-bleed).
   *  Pass the container's horizontal padding so the line escapes it. Default 0. */
  flush?: number | boolean;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged last. */
  style?: ViewStyle;
}

/** Border Color. */
function borderColor(dark: boolean): string {
  return dark ? '#282a2d' : '#e4e4e5';
}

/** ChatKit-style RN divider. */
export function Divider(props: DividerProps): React.ReactElement {
  const { spacing = 0, color, size = 1, flush = false, dark, style } = props;
  const bleed = flush === true ? 16 : typeof flush === 'number' ? flush : 0;

  const base: ViewStyle = {
    height: size,
    backgroundColor: color ?? borderColor(dark),
    marginVertical: spacing,
    marginHorizontal: bleed ? -bleed : 0,
  };

  return <View style={style ? [base, style] : base} />;
}
