import { HERO_ICON_PATHS, type HeroIconName } from '../icons';
import type { CaptionSize, FontWeight } from './node-fields';

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

const CAPTION_SIZE: Record<CaptionSize, 'sm' | 'md'> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
};

export function resolveCaptionSize(
  value: CaptionSize | undefined,
): 'sm' | 'md' | undefined {
  return value === undefined ? undefined : CAPTION_SIZE[value];
}

export function resolveCaptionWeight(
  value: FontWeight | undefined,
): 'normal' | 'medium' | 'semibold' | undefined {
  return value === 'bold' ? 'semibold' : value;
}
