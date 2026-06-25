import { colors } from '@stage-labs/kit/tokens';
import type { ThemeColor } from '@stage-labs/kit/kit';

function pair(light: keyof typeof colors, dark: keyof typeof colors): ThemeColor {
  return { light: colors[light], dark: colors[dark] };
}

export const metroFieldColors = {
  surface: pair('surface-light', 'surface-dark'),
  border: pair('border-light', 'border-dark'),
  head: pair('head-light', 'head-dark'),
  fg: pair('fg-light', 'fg-dark'),
  sub: pair('sub-light', 'sub-dark'),
  bg: pair('bg-light', 'bg-dark'),
  link: pair('link-light', 'link-dark'),
} as const;

export const METRO_MONO_FAMILY = 'Menlo, ui-monospace, monospace';
