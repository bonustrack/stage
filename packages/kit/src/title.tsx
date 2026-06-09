/** Title - ChatKit-styled headings for the Metro mobile client.
 *
 *  A real RN component (imports `react-native` directly) living alongside
 *  Button/Text. Hook-free: the caller passes `dark`. Renders screen / section
 *  titles in Calibre-Semibold at the head colour, matching the app's current
 *  heading typography, stepped clearly above the chat body size (level 1 = 30,
 *  level 2 = 24, level 3 = 21 vs body 19). */

import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { resolveColorToken, type ColorToken } from './tokens';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  /** 1 = screen title, 2 = section, 3 = sub-section. Default 2. */
  level?: TitleLevel;
  /** Alias for level: lg→1, md→2, sm→3. `level` wins if both given. */
  size?: TitleSizeToken;
  /** Heading colour. A semantic ColorToken name resolves scheme-aware via the
   *  kit palette; any other string is a raw colour (escape hatch). Wins over
   *  the head palette colour. */
  color?: ColorToken | (string & {});
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  style?: TextStyle | TextStyle[];
}

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 30, 2: 24, 3: 21 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };

/** ChatKit-style RN heading. */
export function Title(props: TitleProps): React.ReactElement {
  const { level, size, color, dark = false, style, children, ...rest } = props;
  const lvl: TitleLevel = level ?? (size ? TOKEN_LEVEL[size] : 2);

  const base: TextStyle = {
    color: color != null
      ? resolveColorToken(color, dark ? 'dark' : 'light')
      : (dark ? '#ffffff' : '#000000'),
    fontSize: LEVEL_SIZE[lvl],
    fontFamily: 'Calibre-Semibold',
  };

  return (
    <RNText style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base} {...rest}>
      {children}
    </RNText>
  );
}
