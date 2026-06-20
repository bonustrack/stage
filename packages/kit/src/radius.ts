
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

export function isRadiusValue(r: string): r is RadiusValue {
  return r in BOX_RADIUS_SCALE;
}

export function resolveBoxRadius(r: number | string): number | string {
  return typeof r === 'string' && isRadiusValue(r) ? BOX_RADIUS_SCALE[r] : r;
}
