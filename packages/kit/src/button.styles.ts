/** Button styling internals — size specs, variant colour resolution, and the
 *  label text style. Split out of button.tsx to keep each module ≤200 lines.
 *  Mirrors the palette convention in apps/app/lib/theme.ts (head/bg/rowBg/border). */

import type { TextStyle } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface SizeSpec {
  height: number;
  paddingHorizontal: number;
  fontSize: number;
  gap: number;
  spinner: 'small' | 'large';
}

export const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 32, paddingHorizontal: 12, fontSize: 14, gap: 6, spinner: 'small' },
  md: { height: 40, paddingHorizontal: 16, fontSize: 15, gap: 8, spinner: 'small' },
  lg: { height: 48, paddingHorizontal: 20, fontSize: 16, gap: 8, spinner: 'small' },
};

export interface VariantColors {
  /** resting background */
  bg: string;
  /** pressed background (overrides opacity dimming when set) */
  pressedBg?: string;
  text: string;
  borderColor?: string;
  /** faint pressed background for transparent variants */
  ghostPressedBg?: string;
}

const DANGER = '#d6453d';
const DANGER_PRESSED = '#bf3a33';

/** Resolve the colour set for a variant under the given scheme, mirroring the
 *  palette convention in apps/app/lib/theme.ts (head/bg/rowBg/border). */
export function variantColors(variant: ButtonVariant, dark: boolean): VariantColors {
  const head = dark ? '#ffffff' : '#000000';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';
  const border = dark ? '#282a2d' : '#e4e4e5';
  switch (variant) {
    case 'primary':
      return { bg: head, text: bg };
    case 'secondary':
      return { bg: rowBg, text: head, borderColor: border };
    case 'ghost':
      return {
        bg: 'transparent',
        text: head,
        ghostPressedBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      };
    case 'danger':
      return { bg: DANGER, pressedBg: DANGER_PRESSED, text: '#ffffff' };
  }
}

export function textLabelStyle(spec: SizeSpec, color: string): TextStyle {
  return {
    color,
    fontSize: spec.fontSize,
    fontFamily: 'Calibre-Semibold',
    textAlign: 'center',
  };
}
