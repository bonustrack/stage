import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { ICON_VIEW_BOX, iconStroke, type CentralIcon, type IconStyle } from '../glyph';
import type { HeroIconName, HeroSolidIconName, IconName as KitIconName } from '../icons';
import { A2UI_ICONS, isA2uiIconName, type A2uiIconName } from '../icons.a2ui';
import { brandIconPath, isBrandIconName, type BrandIconName } from '../brand-icons.data';
import { centralIcon, isKitIconAliasName } from '../central-icons';
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
    <Svg width={size} height={size} viewBox={ICON_VIEW_BOX}>
      <Path d={d} fill={fill} stroke="none" />
    </Svg>
  );
}

function rosterIcon(name: CentralIconName, style: IconStyle): CentralIcon {
  const entry = CENTRAL_ICONS[name];
  return style === 'solid' ? (entry.solid ?? entry.line) : entry.line;
}

function a2uiIcon(name: A2uiIconName, style: IconStyle): CentralIcon {
  const target = A2UI_ICONS[name];
  return typeof target === 'string' ? centralIcon(target, style) : rosterIcon(target.extra, style);
}

function namedCentralIcon(name: string, style: IconStyle): CentralIcon | undefined {
  return Object.hasOwn(CENTRAL_ICONS, name) ? rosterIcon(name as CentralIconName, style) : undefined;
}

function resolveIcon(name: string, style: IconStyle): CentralIcon | undefined {
  if (isKitIconAliasName(name)) return centralIcon(name, style);
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
  const icon = typeof name === 'string' ? resolveIcon(name, style) : name;
  if (icon !== undefined) return <Glyph icon={icon} size={size} color={color} dark={dark} />;
  return typeof name === 'string' && isBrandIconName(name) ? (
    <PathIcon d={brandIconPath(name)} size={size} fill={iconStroke(color, dark)} />
  ) : null;
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
