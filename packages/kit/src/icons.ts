/**
 * @file Shared HeroIcon path-data vocabulary (re-exporting the generated heroicons.data.ts set plus aliases) for the Vue web client and RN app; each value is an SVG path `d` string or array, stroke currentColor on a 24x24 viewBox.
 */

import { HERO_ICON_DATA } from './heroicons.data';

export const HERO_ICON_PATHS = HERO_ICON_DATA;

export type HeroIconName = keyof typeof HERO_ICON_PATHS;

/** Normalise a stored icon value to the list of SVG path `d` strings a renderer must draw. Single-path icons store a bare string; multi-path icons store an array. */
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
