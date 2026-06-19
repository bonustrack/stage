/**
 * @file Title — a theme-native RN heading component that renders screen/section titles in Calibre-Semibold at the head colour, with three size levels (30/24/21) above the chat body size.
 */

import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { resolveColorToken, type ColorToken } from './tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  /** 1 = screen title, 2 = section, 3 = sub-section. Default 2. */
  level?: TitleLevel;
  /** Alias for level: lg->1, md->2, sm->3. `level` wins if both given. */
  size?: TitleSizeToken;
  /** Override colour (escape hatch). A semantic ColorToken name resolves scheme-aware; any other string is a raw colour. Wins over the head colour. */
  color?: ColorToken | (string & {});
  style?: TextStyle | TextStyle[];
}

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 30, 2: 24, 3: 21 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };

/** ChatKit-style RN heading. */
export function Title(props: TitleProps): React.ReactElement {
  const { level, size, color, style, children, ...rest } = props;
  const lvl: TitleLevel = level ?? (size ? TOKEN_LEVEL[size] : 2);
  const palette = useKitPalette();
  const scheme = useKitScheme();

  const base: TextStyle = {
    // Head colour === palette `link` (#ffffff/#000000), matching today exactly.
    color: color != null ? resolveColorToken(color, scheme) : palette.link,
    fontSize: LEVEL_SIZE[lvl],
    fontFamily: 'Calibre-Semibold',
  };

  return (
    <RNText style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base} {...rest}>
      {children}
    </RNText>
  );
}
