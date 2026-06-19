/** Label - a ChatKit-styled form-field label. Mirrors ChatKit's `Label` widget
 *  (a distinct text node ChatKit keeps separate from Text/Caption because it
 *  labels a form control). Faithful prop names: `value`, `fieldName`, `size`,
 *  `weight`, `textAlign`, `color`. Deviation: `dark` boolean (kit is hook-free)
 *  and `nativeID` wiring derived from `fieldName` so RN screen readers associate
 *  the label with its control. Children are accepted too for parity. */

import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';

/** ChatKit TextSize. */
export type LabelSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** ChatKit Label weight set. */
export type LabelWeight = 'normal' | 'medium' | 'semibold' | 'bold';
/** ChatKit TextAlign. */
export type LabelAlign = 'start' | 'center' | 'end';

const SIZE: Record<LabelSize, number> = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20 };
const FONT: Record<LabelWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};
const ALIGN: Record<LabelAlign, TextStyle['textAlign']> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

export interface LabelProps {
  /** ChatKit: value. The label text (children also accepted). */
  value?: string;
  children?: ReactNode;
  /** ChatKit: fieldName. The `name` of the control this label is for. Used to
   *  derive the RN `nativeID` so screen readers can pair them. */
  fieldName?: string;
  /** ChatKit: size. Default 'md' (15). */
  size?: LabelSize;
  /** ChatKit: weight. Default 'medium'. */
  weight?: LabelWeight;
  /** ChatKit: textAlign. Default 'start'. */
  textAlign?: LabelAlign;
  /** ChatKit: color. Token/hex; falls back to the scheme head color. */
  color?: string;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark?: boolean;
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

/** Head Color. */
function headColor(dark: boolean): string {
  return dark ? '#ffffff' : '#000000';
}

/** ChatKit-style RN form-field label. */
export function Label(props: LabelProps): React.ReactElement {
  const {
    value,
    children,
    fieldName,
    size = 'md',
    weight = 'medium',
    textAlign = 'start',
    color,
    dark = false,
    style,
  } = props;

  const base: TextStyle = {
    color: color ?? headColor(dark),
    fontSize: SIZE[size],
    fontFamily: FONT[weight],
    textAlign: ALIGN[textAlign],
  };

  return (
    <RNText
      nativeID={fieldName ? `label-${fieldName}` : undefined}
      style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base}
    >
      {value ?? children}
    </RNText>
  );
}
