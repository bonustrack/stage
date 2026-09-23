
import { Text as RNText, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { TEXT_ALIGN_MAP, TEXT_FONTS } from '../text.styles';
import { FONT_SIZE } from '../tokens';

export type LabelSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LabelWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type LabelAlign = 'start' | 'center' | 'end';

const SIZE: Record<LabelSize, number> = { xs: FONT_SIZE['2xs'], sm: FONT_SIZE.xs, md: FONT_SIZE.md, lg: FONT_SIZE.xl, xl: FONT_SIZE['4xl'] };

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
    fontFamily: TEXT_FONTS[weight],
    textAlign: TEXT_ALIGN_MAP[textAlign],
  };

  return (
    <RNText
      nativeID={fieldName ? `label-${fieldName}` : undefined}
      style={style ? [base, style] : base}
    >
      {value ?? children}
    </RNText>
  );
}
