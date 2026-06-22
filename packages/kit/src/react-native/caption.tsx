
import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { resolveColorToken, type ColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type CaptionSize = 'sm' | 'md';
export type CaptionWeight = 'normal' | 'medium' | 'semibold';
export type CaptionAlign = 'start' | 'center' | 'end';

const SIZE: Record<CaptionSize, number> = { sm: 12, md: 13 };
const FONT: Record<CaptionWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
};
const ALIGN: Record<CaptionAlign, TextStyle['textAlign']> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

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
    fontFamily: FONT[weight],
    textAlign: ALIGN[textAlign],
  };

  const lines = truncate ? 1 : maxLines;

  return (
    <RNText
      style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base}
      numberOfLines={lines}
    >
      {value ?? children}
    </RNText>
  );
}
