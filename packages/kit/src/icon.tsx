
import { Path, Svg } from 'react-native-svg';
import { heroIconPaths, HERO_ICON_DEFAULTS, type HeroIconName } from '@stage-labs/kit/icons';
import { brandIconPath, type BrandIconName } from './brand-icons.data';

export type { HeroIconName, BrandIconName };

export interface IconProps {
  name: HeroIconName;
  size?: number;
  color?: string;
  dark?: boolean;
  focused?: boolean;
}

export function Icon({ name, size = 22, color, dark, focused }: IconProps): React.ReactElement {
  const stroke = color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      {heroIconPaths(name).map((d, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={focused ? 2.4 : HERO_ICON_DEFAULTS.strokeWidth}
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
  const fill = color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path d={brandIconPath(name)} fill={fill} stroke="none" />
    </Svg>
  );
}
