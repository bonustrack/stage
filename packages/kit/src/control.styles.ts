
import type { DimensionValue, ViewStyle, TextStyle } from 'react-native';
import { FONT_SIZE, fontName, schemePalette } from './tokens';

export function fieldIds(name: string | undefined): {
  nativeID?: string;
  accessibilityLabelledBy?: string;
} {
  if (!name) return {};
  return { nativeID: `input-${name}`, accessibilityLabelledBy: `label-${name}` };
}

export function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

export function triggerRowStyle(block?: boolean, disabled?: boolean): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: block ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
  };
}

export function triggerLabelStyle(color: string, fontSize: number): TextStyle {
  return { flex: 1, color, fontSize, fontFamily: fontName.sans };
}

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
}

export function controlColors(variant: ControlVariant, dark: boolean): ControlColors {
  const p = schemePalette(dark);
  const head = p.head;
  const sub = p.sub;
  const inputBg = dark ? '#1b1c1e' : '#f4f4f5';
  const border = p.border;
  return {
    bg: variant === 'soft' ? inputBg : 'transparent',
    text: head,
    placeholder: sub,
    border: variant === 'outline' ? border : 'transparent',
  };
}

export function controlBoxStyle(
  size: ControlSize,
  variant: ControlVariant,
  colors: ControlColors,
  radius: number,
): ViewStyle {
  const spec = CONTROL_SIZES[size];
  return {
    minHeight: spec.minHeight,
    paddingHorizontal: spec.paddingHorizontal,
    paddingVertical: spec.paddingVertical,
    backgroundColor: colors.bg,
    borderRadius: radius,
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: colors.border,
    outlineWidth: 0,
    outlineStyle: 'solid',
  };
}

export function controlTextStyle(size: ControlSize, colors: ControlColors): TextStyle {
  return {
    color: colors.text,
    fontSize: CONTROL_SIZES[size].fontSize,
    fontFamily: fontName.sans,
    padding: 0,
    margin: 0,
  };
}

export type TextFieldVariant = 'outline' | 'plain';

export interface TextFieldStyleInput {
  variant?: TextFieldVariant;
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

export interface ResolvedTextFieldStyle {
  box: ViewStyle;
  text: TextStyle;
  placeholder: string;
}

function fieldBorder(
  input: TextFieldStyleInput,
  c: ControlColors,
): { width: number; color: string } {
  const plain = input.variant === 'plain';
  const width = plain && input.borderColor === undefined ? 0 : 1;
  return { width, color: input.borderColor ?? c.border };
}

function fieldBackground(input: TextFieldStyleInput, c: ControlColors): string {
  if (input.background !== undefined) return input.background;
  return input.variant === 'plain' ? 'transparent' : c.bg;
}

export function textFieldStyle(
  input: TextFieldStyleInput,
): ResolvedTextFieldStyle {
  const size = CONTROL_SIZES.md;
  const c = input.baseColors;
  const border = fieldBorder(input, c);
  const box: ViewStyle = {
    minHeight: size.minHeight,
    paddingHorizontal: (input.paddingX ?? size.paddingHorizontal) as DimensionValue,
    paddingVertical: (input.paddingY ?? size.paddingVertical) as DimensionValue,
    backgroundColor: fieldBackground(input, c),
    borderRadius: input.radius ?? input.defaultRadius,
    borderWidth: border.width,
    borderColor: border.color,
    outlineWidth: 0,
    outlineStyle: 'solid',
  };
  const text: TextStyle = {
    color: input.color ?? c.text,
    fontSize: input.fontSize ?? size.fontSize,
    fontFamily: input.fontFamily ?? fontName.sans,
    padding: 0,
    margin: 0,
  };
  return { box, text, placeholder: c.placeholder };
}
