/** Icon — renders the shared HeroIcon path data (@metro-labs/kit/icons) as a
 *  react-native-svg glyph. A drop-in for apps/app's <HeroIcon>: same name set,
 *  same currentColor stroke / transparent fill / 24×24 v1-outline viewBox.
 *
 *  A real RN component (imports react-native-svg) living alongside Button/Text/
 *  Title. Hook-free: pass `color` directly, or `dark` to pick the head colour
 *  from the palette convention when no explicit colour is given. */

import { Path, Svg } from 'react-native-svg';
import { heroIconPaths, HERO_ICON_DEFAULTS, type HeroIconName } from '@metro-labs/kit/icons';
import { brandIconPath, type BrandIconName } from './brand-icons.data';

export type { HeroIconName, BrandIconName };

export interface IconProps {
  name: HeroIconName;
  /** Square px. Default 22. */
  size?: number;
  /** Stroke colour. Defaults to the head colour for `dark`, else currentColor. */
  color?: string;
  /** Effective color scheme — only used to default `color`. */
  dark?: boolean;
  /** Thicken the stroke for an active/focused state. */
  focused?: boolean;
}

/** ChatKit-style RN icon. Drop-in for the app's <HeroIcon>. */
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
  /** Square px. Default 22. */
  size?: number;
  /** Fill colour. Defaults to the head colour for `dark`, else currentColor. */
  color?: string;
  /** Effective color scheme — only used to default `color`. */
  dark?: boolean;
}

/** Filled social brand glyph (X, GitHub, Lens, Farcaster). Unlike the stroke-only
 *  Heroicons these are solid marks drawn with fill=currentColor and no stroke. */
export function BrandIcon({ name, size = 22, color, dark }: BrandIconProps): React.ReactElement {
  const fill = color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path d={brandIconPath(name)} fill={fill} stroke="none" />
    </Svg>
  );
}
