/**
 * @file Button styling internals split out of button.tsx: size specs, colour+variant resolution (including legacy colour-name variant aliases), and the label text style.
 */

import type { TextStyle } from 'react-native';
import { FONT_SIZE, colors, schemePalette } from './tokens';

/** ChatKit semantic colour. The canonical `color` prop. */
export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'discovery'
  | 'success'
  | 'caution'
  | 'warning'
  | 'danger';

/** ChatKit control variant - the visual treatment of the colour. */
export type ButtonControlVariant = 'solid' | 'soft' | 'outline' | 'ghost';

/** ChatKit control size scale. The canonical `size` prop accepts the full scale; the four legacy tokens (sm/md/lg/xl) keep their exact dimensions. */
export type ButtonSize =
  | '3xs'
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

/**
 * @deprecated Legacy app `variant` values. These carried colour names AND an
 *  implied treatment (ghost = transparent). Kept as aliases so existing call
 *  sites compile and render identically. Prefer `color` + `variant`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface SizeSpec {
  height: number;
  paddingHorizontal: number;
  fontSize: number;
  gap: number;
  spinner: 'small' | 'large';
}

export const SIZES: Record<ButtonSize, SizeSpec> = {
  '3xs': { height: 24, paddingHorizontal: 8, fontSize: FONT_SIZE['2xs'], gap: 4, spinner: 'small' },
  '2xs': { height: 28, paddingHorizontal: 10, fontSize: FONT_SIZE.xs, gap: 6, spinner: 'small' },
  xs: { height: 30, paddingHorizontal: 11, fontSize: FONT_SIZE.xs, gap: 6, spinner: 'small' },
  sm: { height: 32, paddingHorizontal: 12, fontSize: FONT_SIZE.sm, gap: 6, spinner: 'small' },
  md: { height: 40, paddingHorizontal: 16, fontSize: FONT_SIZE.md, gap: 8, spinner: 'small' },
  lg: { height: 48, paddingHorizontal: 20, fontSize: FONT_SIZE.lg, gap: 8, spinner: 'small' },
  // `xl` is sized so a `pill` icon-only Button renders a 56x56 circle - the
  // original wallet/profile action-circle size. Used icon-only (label below).
  xl: { height: 56, paddingHorizontal: 24, fontSize: FONT_SIZE.lg, gap: 8, spinner: 'small' },
  '2xl': { height: 64, paddingHorizontal: 28, fontSize: FONT_SIZE['2xl'], gap: 10, spinner: 'large' },
  '3xl': { height: 72, paddingHorizontal: 32, fontSize: FONT_SIZE['4xl'], gap: 12, spinner: 'large' },
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

/** Semantic accent hue per ChatKit colour (used as the solid background). */
function accent(
  color: ButtonColor,
  dark: boolean,
): { bg: string; pressed: string; on: string } {
  const head = schemePalette(dark).head;
  const bg = dark ? colors['bg-dark'] : colors['bg-light'];
  switch (color) {
    case 'primary':
      return { bg: head, pressed: head, on: bg };
    case 'secondary': {
      const rowBg = schemePalette(dark).border;
      return { bg: rowBg, pressed: rowBg, on: head };
    }
    case 'info':
      return { bg: '#2f6df6', pressed: '#285fd6', on: '#ffffff' };
    case 'discovery':
      return { bg: '#8b5cf6', pressed: '#7a4de0', on: '#ffffff' };
    case 'success':
      return { bg: '#1f9d57', pressed: '#1b894c', on: '#ffffff' };
    case 'caution':
      return { bg: '#e0a106', pressed: '#c78d05', on: '#1a1300' };
    case 'warning':
      return { bg: '#e07a0c', pressed: '#c76a0a', on: '#ffffff' };
    case 'danger':
      return { bg: DANGER, pressed: DANGER_PRESSED, on: '#ffffff' };
  }
}

/** Resolve a colour set from the canonical ChatKit `color` + `variant` model. */
export function resolveColors(
  color: ButtonColor,
  variant: ButtonControlVariant,
  dark: boolean,
): VariantColors {
  const a = accent(color, dark);
  const border = schemePalette(dark).border;
  const ghostPressedBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const neutralText = schemePalette(dark).head;
  const isNeutral = color === 'primary' || color === 'secondary';
  switch (variant) {
    case 'solid':
      return {
        bg: a.bg,
        pressedBg: a.pressed,
        text: a.on,
        // secondary solid keeps its hairline border (legacy look).
        borderColor: color === 'secondary' ? border : undefined,
      };
    case 'soft': {
      // tinted, low-emphasis fill on the page background.
      const soft = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
      return { bg: soft, text: isNeutral ? neutralText : a.bg, ghostPressedBg };
    }
    case 'outline':
      return {
        bg: 'transparent',
        text: isNeutral ? neutralText : a.bg,
        borderColor: isNeutral ? border : a.bg,
        ghostPressedBg,
      };
    case 'ghost':
      return { bg: 'transparent', text: isNeutral ? neutralText : a.bg, ghostPressedBg };
  }
}

/**
 * @deprecated Map a legacy app `variant` (colour-name) onto the canonical
 *  `color` + `variant` model so old usages render exactly as before.
 */
export function legacyVariantToColor(v: ButtonVariant): {
  color: ButtonColor;
  variant: ButtonControlVariant;
} {
  switch (v) {
    case 'primary':
      return { color: 'primary', variant: 'solid' };
    case 'secondary':
      return { color: 'secondary', variant: 'solid' };
    case 'ghost':
      return { color: 'primary', variant: 'ghost' };
    case 'danger':
      return { color: 'danger', variant: 'solid' };
  }
}

/** Build the text style for a button label at a given size and color. */
export function textLabelStyle(spec: SizeSpec, color: string): TextStyle {
  return {
    color,
    fontSize: spec.fontSize,
    fontFamily: 'Calibre-Semibold',
    textAlign: 'center',
  };
}
