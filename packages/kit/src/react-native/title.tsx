
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { resolveColorToken, type ColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';
export type TitleHeroSize = '6xl' | '7xl';

export interface TitleProps extends Omit<RNTextProps, 'style'> {
  level?: TitleLevel;
  size?: TitleSizeToken;
  hero?: TitleHeroSize;
  color?: ColorToken | (string & {});
  style?: TextStyle | TextStyle[];
}

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 30, 2: 24, 3: 21 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };
const HERO_PX: Record<TitleHeroSize, number> = { '6xl': 44, '7xl': 60 };

function resolveHeroTitlePx(value: TitleHeroSize | undefined): number | undefined {
  return value === undefined ? undefined : HERO_PX[value];
}

export function Title(props: TitleProps): React.ReactElement {
  const { level, size, hero, color, style, children, ...rest } = props;
  const lvl: TitleLevel = level ?? (size ? TOKEN_LEVEL[size] : 2);
  const heroPx = resolveHeroTitlePx(hero);
  const palette = useKitPalette();
  const scheme = useKitScheme();

  const base: TextStyle = {
    color: color != null ? resolveColorToken(color, scheme) : palette.link,
    fontSize: heroPx ?? LEVEL_SIZE[lvl],
    fontFamily: 'Calibre-Semibold',
    ...(heroPx === undefined ? {} : { lineHeight: heroPx * 1.05 }),
  };

  return (
    <RNText style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base} {...rest}>
      {children}
    </RNText>
  );
}
