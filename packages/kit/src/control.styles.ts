/** Shared sizing + colours for ChatKit form controls (Input, Textarea, and
 *  future Select/DatePicker). Mirrors ChatKit's `ControlSize` scale and the
 *  `soft` / `outline` variants. Split out so each control module stays small and
 *  the size/variant tables live in one place. Colours follow the palette
 *  convention in apps/app/lib/theme.ts (head / sub / input-bg / border). */

import type { ViewStyle, TextStyle } from 'react-native';

/** ChatKit ControlSize. */
export type ControlSize = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
/** ChatKit control variant. */
export type ControlVariant = 'soft' | 'outline';

export interface ControlSizeSpec {
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
}

/** ControlSize -> box metrics. `md` reproduces today's input sizing. */
export const CONTROL_SIZES: Record<ControlSize, ControlSizeSpec> = {
  '3xs': { minHeight: 24, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12 },
  '2xs': { minHeight: 28, paddingHorizontal: 9, paddingVertical: 4, fontSize: 13 },
  xs: { minHeight: 32, paddingHorizontal: 10, paddingVertical: 5, fontSize: 14 },
  sm: { minHeight: 36, paddingHorizontal: 11, paddingVertical: 6, fontSize: 14 },
  md: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  lg: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  xl: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, fontSize: 17 },
  '2xl': { minHeight: 64, paddingHorizontal: 18, paddingVertical: 14, fontSize: 18 },
  '3xl': { minHeight: 72, paddingHorizontal: 20, paddingVertical: 16, fontSize: 20 },
};

export interface ControlColors {
  bg: string;
  text: string;
  placeholder: string;
  border: string;
  focusBorder: string;
}

/** Resolve control colours for a variant under the given scheme. */
export function controlColors(variant: ControlVariant, dark: boolean): ControlColors {
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const inputBg = dark ? '#1b1c1e' : '#f4f4f5';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const accent = dark ? '#4f9cf9' : '#2f6fed';
  return {
    bg: variant === 'soft' ? inputBg : 'transparent',
    text: head,
    placeholder: sub,
    border: variant === 'outline' ? border : 'transparent',
    focusBorder: accent,
  };
}

/** Box style shared by Input/Textarea built from a size + variant + radius. */
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

/** Text style for the control's editable text. */
export function controlTextStyle(size: ControlSize, colors: ControlColors): TextStyle {
  return {
    color: colors.text,
    fontSize: CONTROL_SIZES[size].fontSize,
    fontFamily: 'Calibre-Medium',
    padding: 0,
    margin: 0,
  };
}
