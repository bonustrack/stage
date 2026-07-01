
import type { TextStyle } from 'react-native';
import { FONT_SIZE, colors, schemePalette } from './tokens';

export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'discovery'
  | 'success'
  | 'caution'
  | 'warning'
  | 'danger';

export type ButtonControlVariant = 'solid' | 'soft' | 'outline' | 'ghost';

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
  xl: { height: 56, paddingHorizontal: 24, fontSize: FONT_SIZE.lg, gap: 8, spinner: 'small' },
  '2xl': { height: 64, paddingHorizontal: 28, fontSize: FONT_SIZE['2xl'], gap: 10, spinner: 'large' },
  '3xl': { height: 72, paddingHorizontal: 32, fontSize: FONT_SIZE['4xl'], gap: 12, spinner: 'large' },
};

export interface VariantColors {
  bg: string;
  pressedBg?: string;
  text: string;
  borderColor?: string;
  ghostPressedBg?: string;
}

const DANGER = '#d6453d';
const DANGER_PRESSED = '#bf3a33';

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

interface ColorCtx {
  a: { bg: string; pressed: string; on: string };
  border: string;
  ghostPressedBg: string;
  neutralText: string;
  isNeutral: boolean;
  color: ButtonColor;
}

function solidColors(ctx: ColorCtx): VariantColors {
  return {
    bg: ctx.a.bg,
    pressedBg: ctx.a.pressed,
    text: ctx.a.on,
    borderColor: ctx.color === 'secondary' ? ctx.border : undefined,
  };
}

function softColors(ctx: ColorCtx, dark: boolean): VariantColors {
  const soft = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  return { bg: soft, text: ctx.isNeutral ? ctx.neutralText : ctx.a.bg, ghostPressedBg: ctx.ghostPressedBg };
}

function outlineColors(ctx: ColorCtx): VariantColors {
  return {
    bg: 'transparent',
    text: ctx.isNeutral ? ctx.neutralText : ctx.a.bg,
    borderColor: ctx.isNeutral ? ctx.border : ctx.a.bg,
    ghostPressedBg: ctx.ghostPressedBg,
  };
}

function ghostColors(ctx: ColorCtx): VariantColors {
  return { bg: 'transparent', text: ctx.isNeutral ? ctx.neutralText : ctx.a.bg, ghostPressedBg: ctx.ghostPressedBg };
}

export function resolveColors(
  color: ButtonColor,
  variant: ButtonControlVariant,
  dark: boolean,
): VariantColors {
  const ctx: ColorCtx = {
    a: accent(color, dark),
    border: schemePalette(dark).border,
    ghostPressedBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    neutralText: schemePalette(dark).head,
    isNeutral: color === 'primary' || color === 'secondary',
    color,
  };
  switch (variant) {
    case 'solid':
      return solidColors(ctx);
    case 'soft':
      return softColors(ctx, dark);
    case 'outline':
      return outlineColors(ctx);
    case 'ghost':
      return ghostColors(ctx);
  }
}

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

export function textLabelStyle(spec: SizeSpec, color: string): TextStyle {
  return {
    color,
    fontSize: spec.fontSize,
    fontFamily: 'Calibre-Semibold',
    textAlign: 'center',
  };
}

const LEGACY_VARIANTS = new Set<ButtonVariant>(['primary', 'secondary', 'danger']);

export function resolveModel(
  color: ButtonColor | undefined,
  variant: ButtonControlVariant | ButtonVariant | undefined,
  styleColor: 'primary' | 'secondary' | undefined,
): { color: ButtonColor; variant: ButtonControlVariant } {
  if (variant && LEGACY_VARIANTS.has(variant as ButtonVariant) && !color) {
    return legacyVariantToColor(variant as ButtonVariant);
  }
  const baseColor: ButtonColor = color ?? styleColor ?? 'primary';
  const treatment: ButtonControlVariant =
    variant && (['solid', 'soft', 'outline', 'ghost'] as string[]).includes(variant)
      ? (variant as ButtonControlVariant)
      : 'solid';
  return { color: baseColor, variant: treatment };
}
