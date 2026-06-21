
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { resolveColorToken, type ColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  level?: TitleLevel;
  size?: TitleSizeToken;
  color?: ColorToken | (string & {});
  style?: TextStyle | TextStyle[];
}

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 30, 2: 24, 3: 21 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };

export function Title(props: TitleProps): React.ReactElement {
  const { level, size, color, style, children, ...rest } = props;
  const lvl: TitleLevel = level ?? (size ? TOKEN_LEVEL[size] : 2);
  const palette = useKitPalette();
  const scheme = useKitScheme();

  const base: TextStyle = {
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
