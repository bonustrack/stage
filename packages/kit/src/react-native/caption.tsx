
import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { FONT_SIZE, resolveColorToken, type ColorToken } from '../tokens';
import { TEXT_ALIGN_MAP, TEXT_FONTS } from '../text.styles';
import { useKitPalette, useKitScheme } from './theme-context';

export type CaptionSize = 'sm' | 'md';
export type CaptionWeight = 'normal' | 'medium' | 'semibold';
export type CaptionAlign = 'start' | 'center' | 'end';

const SIZE: Record<CaptionSize, number> = { sm: FONT_SIZE['2xs'], md: FONT_SIZE.xs };

export interface CaptionProps {
  value?: string;
  children?: ReactNode;
  size?: CaptionSize;
  weight?: CaptionWeight;
  textAlign?: CaptionAlign;
  color?: ColorToken | (string & {});
  truncate?: boolean;
  maxLines?: number;
  style?: TextStyle | TextStyle[];
}

export function Caption(props: CaptionProps): React.ReactElement {
  const {
    value,
    children,
    size = 'md',
    weight = 'medium',
    textAlign = 'start',
    color,
    truncate,
    maxLines,
    style,
  } = props;

  const palette = useKitPalette();
  const scheme = useKitScheme();

  const base: TextStyle = {
    color: color != null
      ? resolveColorToken(color, scheme)
      : palette.sub,
    fontSize: SIZE[size],
    fontFamily: TEXT_FONTS[weight],
    textAlign: TEXT_ALIGN_MAP[textAlign],
  };

  const lines = truncate ? 1 : maxLines;

  return (
    <RNText
      style={style ? [base, style] : base}
      numberOfLines={lines}
    >
      {value ?? children}
    </RNText>
  );
}
