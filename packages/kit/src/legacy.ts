import type { FontSizeName } from './tokens';

export const RADIUS_DEFAULT = 999;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 999;
export const BUTTON_RADIUS_DEFAULT = 999;

export const FONT_SIZE_SNAP: Record<string, FontSizeName> = {
  '10': '3xs',
  '11': '3xs',
  '12': '3xs',
  '13': '3xs',
  '14': '2xs',
  '15': 'xs',
  '16': 'xs',
  '17': 'sm',
  '18': 'md',
  '19': 'lg',
  '20': 'xl',
  '22': '2xl',
  '24': '2xl',
  '26': '3xl',
  '28': '3xl',
  '34': '3xl',
  '38': '3xl',
} as const;

let defaultButtonRadius: number = BUTTON_RADIUS_DEFAULT;

export function setDefaultButtonRadius(r: number): void {
  if (Number.isFinite(r) && r >= 0) defaultButtonRadius = r;
}

export function getDefaultButtonRadius(): number {
  return defaultButtonRadius;
}

export const HERO_ICON_DEFAULTS = { viewBox: '0 0 24 24', strokeWidth: 1.8, activeStrokeWidth: 1.8 } as const;

export function iconStrokeWidth(focused: boolean | undefined): number {
  return focused ? HERO_ICON_DEFAULTS.activeStrokeWidth : HERO_ICON_DEFAULTS.strokeWidth;
}

export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
