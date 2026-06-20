
import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';

export type LabelSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LabelWeight = 'normal' | 'medium' | 'semibold' | 'bold';
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
  value?: string;
  children?: ReactNode;
  fieldName?: string;
  size?: LabelSize;
  weight?: LabelWeight;
  textAlign?: LabelAlign;
  color?: string;
  dark?: boolean;
  style?: TextStyle | TextStyle[];
}

function headColor(dark: boolean): string {
  return dark ? '#ffffff' : '#000000';
}

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
