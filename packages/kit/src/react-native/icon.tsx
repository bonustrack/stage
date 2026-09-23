
import { Path, Svg } from 'react-native-svg';
import {
  heroIconPaths, iconStroke, iconStrokeWidth, HERO_ICON_DEFAULTS, HERO_SOLID_ICON_PATHS, HERO_SOLID_VIEW_BOX,
  isHeroSolidIconName, type HeroIconName, type HeroSolidIconName, type SolidPath,
} from '../icons';
import { brandIconPath, type BrandIconName } from '../brand-icons.data';

export type { HeroIconName, HeroSolidIconName, BrandIconName };

export type IconVariant = 'outline' | 'solid';

export interface IconProps {
  name: HeroIconName;
  size?: number;
  color?: string;
  dark?: boolean;
  focused?: boolean;
  variant?: IconVariant;
}

function SolidIcon({ name, size, fill }: { name: HeroSolidIconName; size: number; fill: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox={HERO_SOLID_VIEW_BOX}>
      {(HERO_SOLID_ICON_PATHS[name] as readonly SolidPath[]).map((path, i) => (
        <Path key={i} d={path.d} fill={fill} fillRule={path.evenodd === true ? 'evenodd' : 'nonzero'} clipRule={path.evenodd === true ? 'evenodd' : 'nonzero'} />
      ))}
    </Svg>
  );
}

export function Icon({ name, size = 22, color, dark, focused, variant = 'outline' }: IconProps): React.ReactElement {
  const stroke = iconStroke(color, dark);
  if (variant === 'solid' && isHeroSolidIconName(name)) return <SolidIcon name={name} size={size} fill={stroke} />;
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      {heroIconPaths(name).map((d, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={iconStrokeWidth(focused)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export interface BrandIconProps {
  name: BrandIconName;
  size?: number;
  color?: string;
  dark?: boolean;
}

export function BrandIcon({ name, size = 22, color, dark }: BrandIconProps): React.ReactElement {
  const fill = iconStroke(color, dark);
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path d={brandIconPath(name)} fill={fill} stroke="none" />
    </Svg>
  );
}
