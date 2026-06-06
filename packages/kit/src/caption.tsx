/** Caption - a ChatKit-styled small label for the Metro mobile client.
 *
 *  Mirrors OpenAI ChatKit's `Caption` widget node (WidgetNode). Real ChatKit
 *  props kept verbatim: `value`, `size`, `weight`, `textAlign`, `color`,
 *  `truncate`, `maxLines`. The only deviation is the `dark` boolean (kit is
 *  hook-free, the caller passes the effective scheme).
 *
 *  Caption is ChatKit's distinct node for tiny secondary labels (the uppercase
 *  section headers + muted captions that apps/app fakes with
 *  <Text variant="caption">). It defaults to the muted `sub` color and a small
 *  size so promoting a label to Caption removes the per-call font styling.
 *  `value` is the text; children are accepted too for parity with the other
 *  text nodes. */

import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';

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
  /** ChatKit: color. Token/hex; falls back to the scheme sub color. */
  color?: string;
  /** ChatKit: truncate. Single line with ellipsis. */
  truncate?: boolean;
  /** ChatKit: maxLines. Caps the line count. */
  maxLines?: number;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

function subColor(dark: boolean): string {
  return dark ? '#7a7a7e' : '#8a929d';
}

/** ChatKit-style RN caption / section label. */
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
    dark,
    style,
  } = props;

  const base: TextStyle = {
    color: color ?? subColor(dark),
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
