import { fontName } from './tokens';

export const HERO_TITLE_STYLE = {
  '3xl': { fontSize: 38, lineHeight: 46, fontFamily: fontName.sans },
  '4xl': { fontSize: 76, lineHeight: 83.6, fontFamily: fontName.sans },
} as const;

export const BALANCE_TITLE_STYLE = { fontSize: 60, lineHeight: 63, fontFamily: fontName.head } as const;
