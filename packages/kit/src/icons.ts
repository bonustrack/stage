/** Heroicons v1 outline path data — the shared icon vocabulary for both the
 *  Vue web client (apps/ui/src/components/HeroIcon.vue) and the React Native
 *  app (apps/app/components/HeroIcon.tsx).
 *
 *  The full tailwindlabs/heroicons@v1.0.6 `optimized/outline` set (24×24)
 *  lives in the generated `heroicons.data.ts` module, alongside the kit's
 *  hand-tuned custom-named aliases (send=paper-airplane, list=inbox,
 *  faceSmile=emoji-happy, copy=duplicate, etc.) so every existing
 *  `<Icon name="…"/>` call-site keeps working while the whole v1 catalogue is
 *  now addressable app-wide and auto-listed in the Kit Icons gallery.
 *
 *  Each value is either a single SVG path `d` string or — for multi-path
 *  glyphs (cog, camera, eye, fire, academicCap, …) — an array of `d` strings.
 *  The renderers iterate, drawing each sub-path with the same stroke attrs.
 *
 *  Convention: stroke is currentColor, fill is transparent, viewBox is the v1
 *  outline standard 24×24 (do NOT mix in the 20×20 "solid" variant — it
 *  produces glitched icons). Default stroke-width is 1.8; an "active/focused"
 *  state can be signalled by thickening to ~2.4. */

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
