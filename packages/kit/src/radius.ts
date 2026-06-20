/** @file Per-block corner-radius token enum and scale for ChatKit Box/Row/Col (BlockProps.radius), split out of tokens.ts and re-exported from it. */

/** ChatKit Box/Row/Col `radius` token enum (BlockProps.radius), a faithful copy of OpenAI ChatKit's scale: `full` is the pill cap (999), `100%` maps to a 50% radius (circle on a square), `none` = square. */
export type RadiusValue =
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | 'full'
  | '100%'
  | 'none';

/** Box radius token -> px (or '50%' for the circle token); the steps hit the app's common borderRadius values exactly (0/2/4/8/10/12/16/20/24/999) so most of the migration is lossless, with odd px snapping to the nearest step. */
export const BOX_RADIUS_SCALE: Record<RadiusValue, number | string> = {
  none: 0,
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  full: 999,
  '100%': '50%',
} as const;

/** True if `r` is one of the Box radius token names. */
export function isRadiusValue(r: string): r is RadiusValue {
  return r in BOX_RADIUS_SCALE;
}

/** Resolve a Box `radius` prop value: a token name -> px (or '50%'); a raw number or non-token string passes through unchanged (escape hatch, e.g. the live `blockRadius` px or a '12px' literal). */
export function resolveBoxRadius(r: number | string): number | string {
  return typeof r === 'string' && isRadiusValue(r) ? BOX_RADIUS_SCALE[r] : r;
}
