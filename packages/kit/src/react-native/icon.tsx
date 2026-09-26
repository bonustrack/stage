import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';
import { Path, Svg } from 'react-native-svg';
import {
  iconStroke, HERO_ICON_DEFAULTS,
  type CentralIcon, type HeroIconName, type HeroSolidIconName, type IconName, type IconStyle,
} from '../icons';
import { brandIconPath, type BrandIconName } from '../brand-icons.data';
import { centralIcon } from '../central-icons';
import { Glyph } from './glyph';

export type { BrandIconName, CentralIcon, HeroIconName, HeroSolidIconName, IconName };
export { CENTRAL_ICON_ALIASES, centralIcon } from '../central-icons';

export type IconVariant = IconStyle;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  dark?: boolean;
  focused?: boolean;
  variant?: IconVariant;
}

export function Icon({ name, size = 22, color, dark, variant = 'line' }: IconProps): React.ReactElement {
  return <Glyph icon={centralIcon(name, variant)} size={size} color={color} dark={dark} />;
}

export interface BrandIconProps {
  name: BrandIconName;
  size?: number;
  color?: string;
  dark?: boolean;
}

export function BrandIcon({ name, size = 22, color, dark }: BrandIconProps): React.ReactElement {
  if (name === 'pin') return <Glyph icon={IconThumbtack} size={size} color={color} dark={dark} />;
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path d={brandIconPath(name)} fill={iconStroke(color, dark)} stroke="none" />
    </Svg>
  );
}
