
import { FONT_SIZE, readableForeground, resolveColor, type Color, type Scheme } from './tokens';

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

const BADGE_FONT_SIZE: Record<BadgeSize, number> = {
  '3xs': FONT_SIZE['3xs'],
  '2xs': FONT_SIZE['3xs'],
  sm: FONT_SIZE['3xs'],
  md: 15,
  lg: FONT_SIZE.xs,
};

export interface ResolvedBadgeStyle {
  background: string;
  foreground: string;
  fontSize: number;
  borderColor?: string;
}

export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tonedStyle(
  tone: string, variant: BadgeVariant, fontSize: number,
): ResolvedBadgeStyle {
  if (variant === 'soft') {
    return { background: withAlpha(tone, SOFT_ALPHA), foreground: tone, fontSize };
  }
  if (variant === 'outline') {
    return { background: 'transparent', foreground: tone, fontSize, borderColor: tone };
  }
  return { background: tone, foreground: readableForeground(tone), fontSize };
}

export function resolveBadgeStyle(
  color: BadgeColorValue | undefined,
  background: BadgeColorValue | undefined,
  size: BadgeSize | undefined,
  scheme: Scheme,
  variant: BadgeVariant = 'solid',
): ResolvedBadgeStyle {
  const fontSize = BADGE_FONT_SIZE[size ?? 'sm'];
  if (background !== undefined) {
    const bg = resolveColor(background, scheme);
    const fg =
      color === undefined || isSemanticBadgeColor(color)
        ? readableForeground(bg)
        : resolveColor(color, scheme);
    return { background: bg, foreground: fg, fontSize };
  }
  if (color !== undefined && !isSemanticBadgeColor(color)) {
    return tonedStyle(resolveColor(color, scheme), variant, fontSize);
  }
  const tone = isSemanticBadgeColor(color) ? color : 'secondary';
  const semantic = BADGE_SEMANTIC_BG[tone];
  if (variant === 'solid') return { background: semantic, foreground: '#ffffff', fontSize };
  return tonedStyle(semantic, variant, fontSize);
}
