import { HERO_ICON_DATA } from './heroicons.data';

export {
  HERO_SOLID_ICON_PATHS,
  HERO_SOLID_VIEW_BOX,
  isHeroSolidIconName,
  type HeroSolidIconName,
  type SolidPath,
} from './heroicons.solid.data';

type HeroIconName = keyof typeof HERO_ICON_DATA;

const ICON_NAMES = new Set(Object.keys(HERO_ICON_DATA));

export function resolveIconName(name: string | undefined): HeroIconName | undefined {
  if (name === undefined) return undefined;
  const camel = name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
  if (ICON_NAMES.has(camel)) return camel as HeroIconName;
  if (ICON_NAMES.has(name)) return name as HeroIconName;
  return undefined;
}

export function heroIconPaths(name: HeroIconName): readonly string[] {
  const value: string | readonly string[] = HERO_ICON_DATA[name];
  return typeof value === 'string' ? [value] : value;
}
