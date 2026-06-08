/** Heroicons v1 outline path data - shared icon vocabulary for the Vue web
 *  client and the RN app. The full v1.0.6 `optimized/outline` set + custom
 *  aliases live in generated `heroicons.data.ts`. Each value is a single SVG
 *  path `d` string, or an array of `d` strings for multi-path glyphs (renderers
 *  iterate, same stroke attrs per sub-path).
 *
 *  Convention: stroke currentColor, fill transparent, viewBox 24x24. Do NOT mix
 *  in the 20x20 "solid" variant - it produces glitched icons. */

import { HERO_ICON_DATA } from './heroicons.data';

export const HERO_ICON_PATHS = HERO_ICON_DATA;

export type HeroIconName = keyof typeof HERO_ICON_PATHS;

/** Normalise a stored icon value to the list of SVG path `d` strings a
 *  renderer must draw. Single-path icons store a bare string; multi-path icons
 *  store an array. */
export function heroIconPaths(name: HeroIconName): readonly string[] {
  const value: string | readonly string[] = HERO_ICON_PATHS[name];
  return typeof value === 'string' ? [value] : value;
}

/** Shared default rendering attributes — keep both renderers in agreement. */
export const HERO_ICON_DEFAULTS = {
  viewBox: '0 0 24 24',
  strokeWidth: 1.8,
  /** Subtle thickening used to signal an active/focused tab. */
  activeStrokeWidth: 2.4,
} as const;
