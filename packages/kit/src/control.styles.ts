import type { DimensionValue, ViewStyle, TextStyle } from 'react-native';
import { CONTROL_RADIUS_DEFAULT, FONT_SIZE, fontName, schemePalette } from './tokens';

export function fieldIds(name: string | undefined): { nativeID?: string; accessibilityLabelledBy?: string } {
  if (!name) return {};
  return { nativeID: `input-${name}`, accessibilityLabelledBy: `label-${name}` };
}

export function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

export function triggerRowStyle(block?: boolean, disabled?: boolean): ViewStyle {
  return { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: block ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1 };
}

export function triggerLabelStyle(color: string, fontSize: number): TextStyle {
  return { flex: 1, color, fontSize, fontFamily: fontName.sans };
}

export type ControlSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ControlVariant = 'soft' | 'outline';

export interface ControlSizeSpec {
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
}

export const CONTROL_SIZES: Record<ControlSize, ControlSizeSpec> = {
  xs: { minHeight: 32, paddingHorizontal: 10, paddingVertical: 5, fontSize: FONT_SIZE['2xs'] },
  sm: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 6, fontSize: FONT_SIZE['2xs'] },
  md: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: FONT_SIZE.xs },
  lg: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, fontSize: FONT_SIZE.xs },
  xl: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, fontSize: FONT_SIZE.sm },
};

export interface ControlColors {
  bg: string;
  text: string;
  placeholder: string;
  border: string;
}

export function controlColors(variant: ControlVariant, dark: boolean): ControlColors {
  const p = schemePalette(dark);
  return {
    bg: variant === 'soft' ? (dark ? '#1b1c1e' : '#f4f4f5') : 'transparent',
    text: p.head,
    placeholder: p.sub,
    border: variant === 'outline' ? p.border : 'transparent',
  };
}

export function controlBoxStyle(size: ControlSize, variant: ControlVariant, colors: ControlColors, radius: number): ViewStyle {
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
  return { color: colors.text, fontSize: FONT_SIZE[size], fontFamily: fontName.sans, padding: 0, margin: 0 };
}

export interface TextFieldStyleInput {
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

export function textFieldStyle(input: TextFieldStyleInput): ResolvedTextFieldStyle {
  const size = CONTROL_SIZES.md;
  const c = input.baseColors;
  const box: ViewStyle = {
    minHeight: size.minHeight,
    paddingHorizontal: (input.paddingX ?? size.paddingHorizontal) as DimensionValue,
    paddingVertical: (input.paddingY ?? size.paddingVertical) as DimensionValue,
    backgroundColor: input.background ?? 'transparent',
    borderRadius: input.radius ?? CONTROL_RADIUS_DEFAULT,
    borderWidth: input.borderColor === undefined ? 0 : 1,
    borderColor: input.borderColor ?? c.border,
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
