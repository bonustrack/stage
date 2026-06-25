
import type { BadgeColor, BadgeColorValue, BadgeSize } from './node-fields';
import { readableForeground, resolveColor, type Scheme } from './resolve';

const BADGE_SEMANTIC_BG: Record<BadgeColor, string> = {
  secondary: '#8a929d',
  success: '#1f9d55',
  danger: '#e3342f',
  warning: '#f6993f',
  info: '#3490dc',
  discovery: '#7e5bef',
};

const BADGE_COLOR_NAMES = new Set<BadgeColor>([
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'discovery',
]);

function isSemanticBadgeColor(
  value: BadgeColorValue | undefined,
): value is BadgeColor {
  return typeof value === 'string' && BADGE_COLOR_NAMES.has(value as BadgeColor);
}

export type BadgeFontToken = '3xs' | '2xs' | 'xs';

const BADGE_FONT_TOKEN: Record<BadgeSize, BadgeFontToken> = {
  '3xs': '3xs',
  '2xs': '2xs',
  sm: 'xs',
  md: 'xs',
  lg: 'xs',
};

export interface ResolvedBadgeStyle {
  background: string;
  foreground: string;
  fontToken: BadgeFontToken;
}

export function resolveBadgeStyle(
  color: BadgeColorValue | undefined,
  background: BadgeColorValue | undefined,
  size: BadgeSize | undefined,
  scheme: Scheme,
): ResolvedBadgeStyle {
  const fontToken = BADGE_FONT_TOKEN[size ?? 'sm'];
  if (background !== undefined) {
    const bg = resolveColor(background, scheme);
    const fg =
      color === undefined || isSemanticBadgeColor(color)
        ? readableForeground(bg)
        : resolveColor(color, scheme);
    return { background: bg, foreground: fg, fontToken };
  }
  if (color !== undefined && !isSemanticBadgeColor(color)) {
    const bg = resolveColor(color, scheme);
    return { background: bg, foreground: readableForeground(bg), fontToken };
  }
  const tone = isSemanticBadgeColor(color) ? color : 'secondary';
  return { background: BADGE_SEMANTIC_BG[tone], foreground: '#ffffff', fontToken };
}
