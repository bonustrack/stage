
import { readableForeground, resolveColor, type Color, type Scheme } from './tokens';

export type BadgeColor =
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'discovery';

export type BadgeColorValue = Color;

export type BadgeSize = '3xs' | '2xs' | 'sm' | 'md' | 'lg';

export type BadgeVariant = 'solid' | 'soft' | 'outline';

const SOFT_ALPHA = 0.16;

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
  borderColor?: string;
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tonedStyle(
  tone: string, variant: BadgeVariant, fontToken: BadgeFontToken,
): ResolvedBadgeStyle {
  if (variant === 'soft') {
    return { background: withAlpha(tone, SOFT_ALPHA), foreground: tone, fontToken };
  }
  if (variant === 'outline') {
    return { background: 'transparent', foreground: tone, fontToken, borderColor: tone };
  }
  return { background: tone, foreground: readableForeground(tone), fontToken };
}

export function resolveBadgeStyle(
  color: BadgeColorValue | undefined,
  background: BadgeColorValue | undefined,
  size: BadgeSize | undefined,
  scheme: Scheme,
  variant: BadgeVariant = 'solid',
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
    return tonedStyle(resolveColor(color, scheme), variant, fontToken);
  }
  const tone = isSemanticBadgeColor(color) ? color : 'secondary';
  const semantic = BADGE_SEMANTIC_BG[tone];
  if (variant === 'solid') return { background: semantic, foreground: '#ffffff', fontToken };
  return tonedStyle(semantic, variant, fontToken);
}
