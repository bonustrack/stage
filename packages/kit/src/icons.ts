import { HERO_ICON_DATA } from './heroicons.data';

export { isBrandIconName, brandIconPath, type BrandIconName } from './brand-icons.data';
export type { IconName } from './central-icons';
export { iconStroke, type CentralIcon, type IconStyle } from './glyph';
export { HERO_ICON_DEFAULTS, iconStrokeWidth } from './legacy';
export {
  HERO_SOLID_ICON_PATHS,
  HERO_SOLID_VIEW_BOX,
  heroIconPaths,
  isHeroSolidIconName,
  resolveIconName,
  type HeroSolidIconName,
  type SolidPath,
} from './legacy.icons';

export const HERO_ICON_PATHS = HERO_ICON_DATA;

export type HeroIconName = keyof typeof HERO_ICON_PATHS;
