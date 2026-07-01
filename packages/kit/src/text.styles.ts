import { FONT_SIZE, type FontSizeName } from './tokens';

export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

export type TextRole =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'link'
  | 'primary'
  | 'danger'
  | 'success';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

export type TextSizeToken = FontSizeName;

export type TextAlign = 'start' | 'center' | 'end';

export type ResolvedTextAlign = 'left' | 'center' | 'right';

export interface TextRolePalette {
  sub: string;
  link: string;
  primary: string;
  danger: string;
  success: string;
}

export const TEXT_FONTS: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

export const TEXT_WEIGHT_NUM: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: '500',
  medium: '500',
  semibold: '600',
  bold: '600',
};

export function normalizeTextWeight(w: TextWeight): keyof typeof TEXT_FONTS {
  return w === 'regular' ? 'normal' : w;
}

export function resolveTextSize(
  size: TextSizeToken | undefined,
  variant: TextVariant | undefined,
): number {
  if (size) return FONT_SIZE[size];
  return variant === 'caption' ? FONT_SIZE.xs : FONT_SIZE.md;
}

export function textVariantRole(variant: TextVariant | undefined): TextRole {
  if (variant === 'secondary' || variant === 'caption') return 'secondary';
  return 'default';
}

export function textRoleColor(role: TextRole, palette: TextRolePalette): string {
  switch (role) {
    case 'secondary':
    case 'muted':
      return palette.sub;
    case 'link':
      return palette.link;
    case 'primary':
      return palette.primary;
    case 'danger':
      return palette.danger;
    case 'success':
      return palette.success;
    default:
      return palette.link;
  }
}

export const TEXT_ALIGN_MAP: Record<TextAlign, ResolvedTextAlign> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

export function textFontFamily(
  variant: TextVariant | undefined,
  weight: TextWeight,
): string {
  return variant === 'mono' ? 'Menlo' : TEXT_FONTS[normalizeTextWeight(weight)];
}
