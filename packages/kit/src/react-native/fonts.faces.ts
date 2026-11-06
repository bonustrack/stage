import calibreMedium from '../fonts/Calibre-Medium-Custom.ttf';
import calibreSemibold from '../fonts/Calibre-Semibold-Custom.ttf';
import { fontName } from '../tokens';

export const KIT_FONTS: Record<string, string | number> = { [fontName.sans]: calibreMedium, [fontName.head]: calibreSemibold };

export const KIT_FONT_STYLE_ID = 'stage-kit-fonts';

export interface KitFontFace {
  family: string;
  src: string;
  weight?: string;
  display?: string;
  sizeAdjust?: string;
  ascentOverride?: string;
  descentOverride?: string;
  lineGapOverride?: string;
}

const DESCRIPTORS: readonly (readonly [Exclude<keyof KitFontFace, 'family' | 'src'>, string])[] = [
  ['weight', 'font-weight'],
  ['display', 'font-display'],
  ['sizeAdjust', 'size-adjust'],
  ['ascentOverride', 'ascent-override'],
  ['descentOverride', 'descent-override'],
  ['lineGapOverride', 'line-gap-override'],
];

export function fontFaceCss(face: KitFontFace): string {
  const descriptors = DESCRIPTORS.flatMap(([key, name]) => {
    const value = face[key];
    return value === undefined ? [] : [` ${name}: ${value};`];
  }).join('');
  return `@font-face { font-family: "${face.family}"; src: ${face.src};${descriptors} }`;
}

export const KIT_FONT_FACES: readonly KitFontFace[] = Object.entries(KIT_FONTS).map(([family, source]) => ({
  family,
  src: `url('${String(source)}') format('truetype')`,
}));
