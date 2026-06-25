
import type { DimensionValue, ViewStyle, TextStyle } from 'react-native';
import { FONT_SIZE, schemePalette } from './tokens';

export type ControlSize = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type ControlVariant = 'soft' | 'outline';

export interface ControlSizeSpec {
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
}

export const CONTROL_SIZES: Record<ControlSize, ControlSizeSpec> = {
  '3xs': { minHeight: 24, paddingHorizontal: 8, paddingVertical: 3, fontSize: FONT_SIZE['2xs'] },
  '2xs': { minHeight: 28, paddingHorizontal: 9, paddingVertical: 4, fontSize: FONT_SIZE.xs },
  xs: { minHeight: 32, paddingHorizontal: 10, paddingVertical: 5, fontSize: FONT_SIZE.sm },
  sm: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 6, fontSize: FONT_SIZE.sm },
  md: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: FONT_SIZE.md },
  lg: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, fontSize: FONT_SIZE.lg },
  xl: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, fontSize: FONT_SIZE.xl },
  '2xl': { minHeight: 64, paddingHorizontal: 18, paddingVertical: 14, fontSize: FONT_SIZE['2xl'] },
  '3xl': { minHeight: 72, paddingHorizontal: 20, paddingVertical: 16, fontSize: FONT_SIZE['4xl'] },
};

export interface ControlColors {
  bg: string;
  text: string;
  placeholder: string;
  border: string;
  focusBorder: string;
}

export function controlColors(variant: ControlVariant, dark: boolean): ControlColors {
  const p = schemePalette(dark);
  const head = p.head;
  const sub = p.sub;
  const inputBg = dark ? '#1b1c1e' : '#f4f4f5';
  const border = p.border;
  const accent = dark ? '#4f9cf9' : '#2f6fed';
  return {
    bg: variant === 'soft' ? inputBg : 'transparent',
    text: head,
    placeholder: sub,
    border: variant === 'outline' ? border : 'transparent',
    focusBorder: accent,
  };
}

export function controlBoxStyle(
  size: ControlSize,
  variant: ControlVariant,
  colors: ControlColors,
  radius: number,
  focused: boolean,
): ViewStyle {
  const spec = CONTROL_SIZES[size];
  return {
    minHeight: spec.minHeight,
    paddingHorizontal: spec.paddingHorizontal,
    paddingVertical: spec.paddingVertical,
    backgroundColor: colors.bg,
    borderRadius: radius,
    borderWidth: variant === 'outline' || focused ? 1 : 0,
    borderColor: focused ? colors.focusBorder : colors.border,
  };
}

export function controlTextStyle(size: ControlSize, colors: ControlColors): TextStyle {
  return {
    color: colors.text,
    fontSize: CONTROL_SIZES[size].fontSize,
    fontFamily: 'Calibre-Medium',
    padding: 0,
    margin: 0,
  };
}

export type TextFieldVariant = 'outline' | 'plain';

export interface TextFieldStyleInput {
  variant?: TextFieldVariant;
  focused: boolean;
  defaultRadius: number;
  baseColors: ControlColors;
  background?: string;
  borderColor?: string;
  radius?: number | string;
  paddingX?: number | string;
  paddingY?: number | string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

export interface ResolvedTextFieldSpec {
  minHeight: number;
  paddingX: number | string;
  paddingY: number | string;
  background: string;
  radius: number | string;
  borderWidth: number;
  borderColor: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  placeholder: string;
}

export interface ResolvedTextFieldStyle {
  box: ViewStyle;
  text: TextStyle;
  placeholder: string;
  spec: ResolvedTextFieldSpec;
}

function fieldBorder(
  input: TextFieldStyleInput,
  c: ControlColors,
): { width: number; color: string } {
  const plain = input.variant === 'plain';
  const width = plain && input.borderColor === undefined ? 0 : 1;
  const color = input.focused
    ? c.focusBorder
    : (input.borderColor ?? c.border);
  return { width, color };
}

function fieldBackground(input: TextFieldStyleInput, c: ControlColors): string {
  if (input.background !== undefined) return input.background;
  return input.variant === 'plain' ? 'transparent' : c.bg;
}

export function textFieldSpec(input: TextFieldStyleInput): ResolvedTextFieldSpec {
  const size = CONTROL_SIZES.md;
  const c = input.baseColors;
  const border = fieldBorder(input, c);
  return {
    minHeight: size.minHeight,
    paddingX: input.paddingX ?? size.paddingHorizontal,
    paddingY: input.paddingY ?? size.paddingVertical,
    background: fieldBackground(input, c),
    radius: input.radius ?? input.defaultRadius,
    borderWidth: border.width,
    borderColor: border.color,
    color: input.color ?? c.text,
    fontSize: input.fontSize ?? size.fontSize,
    fontFamily: input.fontFamily ?? 'Calibre-Medium',
    placeholder: c.placeholder,
  };
}

export function textFieldStyle(
  input: TextFieldStyleInput,
): ResolvedTextFieldStyle {
  const s = textFieldSpec(input);
  const box: ViewStyle = {
    minHeight: s.minHeight,
    paddingHorizontal: s.paddingX as DimensionValue,
    paddingVertical: s.paddingY as DimensionValue,
    backgroundColor: s.background,
    borderRadius: s.radius,
    borderWidth: s.borderWidth,
    borderColor: s.borderColor,
  };
  const text: TextStyle = {
    color: s.color,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    padding: 0,
    margin: 0,
  };
  return { box, text, placeholder: s.placeholder, spec: s };
}
