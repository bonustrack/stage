
import { HERO_ICON_DATA } from './heroicons.data';

export const HERO_ICON_PATHS = HERO_ICON_DATA;

export type HeroIconName = keyof typeof HERO_ICON_PATHS;

const ICON_NAMES = new Set(Object.keys(HERO_ICON_PATHS));

export function resolveIconName(
  name: string | undefined,
): HeroIconName | undefined {
  if (name === undefined) return undefined;
  const camel = name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
  if (ICON_NAMES.has(camel)) return camel as HeroIconName;
  if (ICON_NAMES.has(name)) return name as HeroIconName;
  return undefined;
}

export function heroIconPaths(name: HeroIconName): readonly string[] {
  const value: string | readonly string[] = HERO_ICON_PATHS[name];
  return typeof value === 'string' ? [value] : value;
}

export const HERO_ICON_DEFAULTS = {
  viewBox: '0 0 24 24',
  strokeWidth: 1.8,
  activeStrokeWidth: 1.8,
} as const;

export function iconStroke(color: string | undefined, dark: boolean | undefined): string {
  return color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
}

export function iconStrokeWidth(focused: boolean | undefined): number {
  return focused ? HERO_ICON_DEFAULTS.activeStrokeWidth : HERO_ICON_DEFAULTS.strokeWidth;
}
