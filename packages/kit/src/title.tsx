/** Title — ChatKit-styled headings for the Metro mobile client.
 *
 *  A real RN component (imports `react-native` directly) living alongside
 *  Button/Text. Hook-free: the caller passes `dark`. Renders screen / section
 *  titles in Calibre-Semibold at the head colour, matching the app's current
 *  heading typography (level 1 ≈ 28, level 2 ≈ 22, level 3 ≈ 18). */

import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  /** 1 = screen title, 2 = section, 3 = sub-section. Default 2. */
  level?: TitleLevel;
  /** Alias for level: lg→1, md→2, sm→3. `level` wins if both given. */
  size?: TitleSizeToken;
  /** Override colour; wins over the head palette colour. */
  color?: string;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  style?: TextStyle | TextStyle[];
}

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 28, 2: 22, 3: 18 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };

/** ChatKit-style RN heading. */
export function Title(props: TitleProps): React.ReactElement {
  const { level, size, color, dark = false, style, children, ...rest } = props;
  const lvl: TitleLevel = level ?? (size ? TOKEN_LEVEL[size] : 2);

  const base: TextStyle = {
    color: color ?? (dark ? '#ffffff' : '#000000'),
    fontSize: LEVEL_SIZE[lvl],
    fontFamily: 'Calibre-Semibold',
  };

  return (
    <RNText style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base} {...rest}>
      {children}
    </RNText>
  );
}
