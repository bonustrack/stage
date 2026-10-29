import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';
import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import {
  iconStroke,
  HERO_ICON_DEFAULTS,
  type CentralIcon,
  type HeroIconName,
  type HeroSolidIconName,
  type IconName as KitIconName,
  type IconStyle,
} from '../icons';
import { IconBackward } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBackward';
import { IconBellOff } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBellOff';
import { IconBrokenHeart } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBrokenHeart';
import { IconMute } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMute';
import { IconSkip } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSkip';
import { IconStarLines } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconStarLines';
import { IconVolumeDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVolumeDown';
import { A2UI_ICONS, isA2uiIconName, type A2uiExtraIcon, type A2uiIconName } from '../icons.a2ui';
import { brandIconPath, isBrandIconName, type BrandIconName } from '../brand-icons.data';
import { CENTRAL_ICON_ALIASES, centralIcon } from '../central-icons';
import { CENTRAL_ICONS } from '../central-icons.named.data';
import type { CentralIconName } from '../central-icons.names.data';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { useContentColor } from './content-color';
import { Glyph } from './glyph';

export type { A2uiIconName, BrandIconName, CentralIcon, CentralIconName, HeroIconName, HeroSolidIconName };
export { CENTRAL_ICON_ALIASES, centralIcon } from '../central-icons';

export type IconName = KitIconName | A2uiIconName | BrandIconName | CentralIconName;

export type IconVariant = IconStyle | 'outline';

export interface IconProps extends A2uiCommonProps {
  name: IconName | { svgPath: string };
  size?: number;
  color?: string;
  dark?: boolean;
  focused?: boolean;
  variant?: IconVariant;
}

function PathIcon({ d, size, fill }: { d: string; size: number; fill: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path d={d} fill={fill} stroke="none" />
    </Svg>
  );
}

const A2UI_EXTRA_ICONS: Record<A2uiExtraIcon, CentralIcon> = {
  brokenHeart: IconBrokenHeart,
  bellOff: IconBellOff,
  skip: IconSkip,
  backward: IconBackward,
  starLines: IconStarLines,
  volumeDown: IconVolumeDown,
  mute: IconMute,
};

function a2uiIcon(name: A2uiIconName, style: IconStyle): CentralIcon {
  const target = A2UI_ICONS[name];
  return typeof target === 'string' ? centralIcon(target, style) : A2UI_EXTRA_ICONS[target.extra];
}

function isKitIconName(name: string): name is HeroIconName {
  return Object.hasOwn(CENTRAL_ICON_ALIASES, name);
}

function namedCentralIcon(name: string, style: IconStyle): CentralIcon | undefined {
  if (!Object.hasOwn(CENTRAL_ICONS, name)) return undefined;
  const entry = CENTRAL_ICONS[name as CentralIconName];
  return style === 'solid' ? (entry.solid ?? entry.line) : entry.line;
}

function resolveIcon(name: KitIconName | A2uiIconName | CentralIconName, style: IconStyle): CentralIcon | undefined {
  if (typeof name !== 'string') return name;
  if (isKitIconName(name)) return centralIcon(name, style);
  return isA2uiIconName(name) ? a2uiIcon(name, style) : namedCentralIcon(name, style);
}

interface GlyphOfProps {
  name: IconProps['name'];
  size: number;
  color: string | undefined;
  dark: boolean | undefined;
  style: IconStyle;
}

function IconGlyph({ name, size, color, dark, style }: GlyphOfProps): React.ReactElement | null {
  if (typeof name === 'object' && 'svgPath' in name) return <PathIcon d={name.svgPath} size={size} fill={iconStroke(color, dark)} />;
  if (typeof name === 'string' && isBrandIconName(name)) {
    if (name === 'pin') return <Glyph icon={IconThumbtack} size={size} color={color} dark={dark} />;
    return <PathIcon d={brandIconPath(name)} size={size} fill={iconStroke(color, dark)} />;
  }
  const icon = resolveIcon(name, style);
  return icon === undefined ? null : <Glyph icon={icon} size={size} color={color} dark={dark} />;
}

export function Icon({ name, size = 22, color, dark, variant = 'line', weight, accessibility }: IconProps): React.ReactElement | null {
  const inherited = useContentColor();
  const resolved = color ?? (dark === undefined ? inherited : undefined);
  const glyph = <IconGlyph name={name} size={size} color={resolved} dark={dark} style={variant === 'solid' ? 'solid' : 'line'} />;
  if (weight === undefined && accessibility === undefined) return glyph;
  return (
    <View style={weightStyle(weight)} {...accessibilityProps(accessibility)}>
      {glyph}
    </View>
  );
}
