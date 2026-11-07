import type { TEXT_ALIGNS, TEXT_FONT_FAMILIES, TEXT_VARIANTS, TEXT_WEIGHTS } from './kit-vocabulary';
import { FONT_SIZE, FONT_SIZE_DEFAULT, fontName, type FontSizeName } from './tokens';

export type TextVariant = (typeof TEXT_VARIANTS)[number];

export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export type TextSizeToken = FontSizeName;

export type TextAlign = (typeof TEXT_ALIGNS)[number];

export type TextFontFamily = (typeof TEXT_FONT_FAMILIES)[number];

export type ResolvedTextAlign = 'left' | 'center' | 'right';

export interface TextDefaultPalette {
  sub: string;
  link: string;
}

export const TEXT_FONTS: Record<TextWeight, string> = {
  normal: fontName.sans,
  medium: fontName.sans,
  semibold: fontName.head,
  bold: fontName.head,
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
