/** Caption - a ChatKit-styled small label. Mirrors ChatKit's `Caption` widget;
 *  deviation: `dark` boolean (kit is hook-free). Tiny secondary labels (section
 *  headers / muted captions); defaults to muted `sub` colour + small size.
 *  `value` is the text; children are accepted too for parity. */

import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { resolveColorToken, type ColorToken } from './tokens';
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
  /** ChatKit: value. The label text (children also accepted). */
  value?: string;
  children?: ReactNode;
  /** ChatKit: size. Default 'md' (13). */
  size?: CaptionSize;
  /** ChatKit: weight. Default 'medium'. */
  weight?: CaptionWeight;
  /** ChatKit: textAlign. Default 'start'. */
  textAlign?: CaptionAlign;
  /** ChatKit: color. A semantic ColorToken name resolves scheme-aware via the
   *  kit palette; any other string is a raw colour (escape hatch). Falls back to
   *  the scheme sub colour. */
  color?: ColorToken | (string & {});
  /** ChatKit: truncate. Single line with ellipsis. */
  truncate?: boolean;
  /** ChatKit: maxLines. Caps the line count. */
  maxLines?: number;
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

/** ChatKit-style RN caption / section label. THEME-NATIVE: defaults to the
 *  palette `sub` (secondary grey) from the Kit theme provider. */
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
