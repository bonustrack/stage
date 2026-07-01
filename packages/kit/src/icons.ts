
import { HERO_ICON_DATA } from './heroicons.data';

export const HERO_ICON_PATHS = HERO_ICON_DATA;

export type HeroIconName = keyof typeof HERO_ICON_PATHS;

export function heroIconPaths(name: HeroIconName): readonly string[] {
  const value: string | readonly string[] = HERO_ICON_PATHS[name];
  return typeof value === 'string' ? [value] : value;
}

export const HERO_ICON_DEFAULTS = {
  viewBox: '0 0 24 24',
  strokeWidth: 1.8,
  activeStrokeWidth: 2.4,
} as const;

export function iconStroke(color: string | undefined, dark: boolean | undefined): string {
  return color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
}

export function iconStrokeWidth(focused: boolean | undefined): number {
  return focused ? 2.4 : HERO_ICON_DEFAULTS.strokeWidth;
}
