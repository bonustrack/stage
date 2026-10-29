import { FONT_SIZE, FONT_SIZE_DEFAULT, fontName, type FontSizeName } from './tokens';

export type TextVariant = 'body' | 'caption';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export type TextSizeToken = FontSizeName;

export type TextAlign = 'start' | 'center' | 'end';

export type TextFontFamily = 'sans' | 'head' | 'mono';

export type ResolvedTextAlign = 'left' | 'center' | 'right';

export interface TextDefaultPalette {
  sub: string;
  link: string;
}

export const TEXT_FONTS: Record<TextWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

export function resolveTextSize(size: TextSizeToken | undefined, variant: TextVariant | undefined): number {
  if (size) return FONT_SIZE[size];
  return variant === 'caption' ? FONT_SIZE['3xs'] : FONT_SIZE[FONT_SIZE_DEFAULT];
}

export function textDefaultColor(variant: TextVariant | undefined, palette: TextDefaultPalette, inherited?: string): string {
  if (variant === 'caption') return palette.sub;
  return inherited ?? palette.link;
}

export const TEXT_ALIGN_MAP: Record<TextAlign, ResolvedTextAlign> = { start: 'left', center: 'center', end: 'right' };

export function textFontFamily(family: TextFontFamily | undefined, weight: TextWeight): string {
  if (family === 'mono' || family === 'head') return fontName[family];
  return TEXT_FONTS[weight];
}
