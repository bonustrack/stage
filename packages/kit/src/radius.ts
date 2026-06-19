/**
 * @file Per-block corner-radius token enum and scale for ChatKit Box/Row/Col (BlockProps.radius), split out of tokens.ts and re-exported from it.
 */

/**
 * ChatKit Box/Row/Col `radius` token enum (BlockProps.radius). A faithful
 *  copy of OpenAI ChatKit's per-block corner-radius scale. `full` is the pill
 *  cap (999 here, matching the app's existing fully-rounded look); `100%` maps
 *  to a 50% radius (perfect circle on a square). `none` = square.
 */
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

/**
 * Box radius token -> px (or '50%' for the circle token). The numeric steps
 *  are chosen to hit the app's common borderRadius values exactly
 *  (0/2/4/8/10/12/16/20/24/999), so the bulk of the radius migration is
 *  lossless; a handful of odd px (9/11/14/15/17/18/22/64) snap to the nearest
 *  step (documented in the PR).
 */
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
