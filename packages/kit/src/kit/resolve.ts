
import type { Align, Justify } from '../layout';
import { resolveColorToken } from '../tokens';
import { isRadiusValue, resolveBoxRadius } from '../radius';
import type {
  ButtonColor as KitButtonColor,
  ButtonControlVariant,
} from '../button.styles';
import type {
  ControlSize as KitControlSize,
  ControlVariant as KitControlVariant,
} from '../control.styles';
import type {
  Alignment,
  BadgeColor,
  Border,
  Borders,
  BorderValue,
  ButtonColor,
  ButtonColorValue,
  Color,
  ControlVariant,
  Dimension,
  FieldVariant,
  FlexDirection,
  FlexWrap,
  FontWeight,
  Justification,
  Position,
  PositionFields,
  RadiusValue,
  SpacingValue,
  SpinnerSize,
  ThemeColor,
} from './node-fields';
import type { WidgetNode } from './nodes';

const BUTTON_COLOR_NAMES = new Set<ButtonColor>([
  'primary',
  'secondary',
  'info',
  'discovery',
  'success',
  'caution',
  'warning',
  'danger',
]);

export function isSemanticButtonColor(
  value: ButtonColorValue | undefined,
): value is ButtonColor {
  return typeof value === 'string' && BUTTON_COLOR_NAMES.has(value as ButtonColor);
}

export interface ResolvedButtonStyle {
  color: ButtonColor;
  tintBg?: string;
  tintFg?: string;
}

function readableForeground(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const group = m?.[1];
  if (group === undefined) return '#ffffff';
  const n = Number.parseInt(group, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

export function resolveButtonStyle(
  color: ButtonColorValue | undefined,
  background: Color | undefined,
  scheme: Scheme,
): ResolvedButtonStyle {
  const fallback = isSemanticButtonColor(color) ? undefined : color;
  const custom = background ?? fallback;
  if (custom === undefined) {
    return { color: isSemanticButtonColor(color) ? color : 'primary' };
  }
  const bg = resolveColor(custom, scheme);
  return { color: 'primary', tintBg: bg, tintFg: readableForeground(bg) };
}

const HERO_TITLE_PX: Record<string, number> = { '6xl': 44, '7xl': 60 };

export function resolveHeroTitlePx(value: string | undefined): number | undefined {
  return value === undefined ? undefined : HERO_TITLE_PX[value];
}

const SPINNER_PX: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 36 };

export function resolveSpinnerSize(value: SpinnerSize | number | undefined): number {
  if (typeof value === 'number') return value;
  return value === undefined ? 24 : SPINNER_PX[value];
}

export type Scheme = 'light' | 'dark';
export type StyleEntries = Record<string, string | number>;

const ALIGN_MAP: Record<Alignment, Align> = {
  start: 'start',
  center: 'center',
  end: 'end',
  baseline: 'baseline',
  stretch: 'stretch',
};

const JUSTIFY_MAP: Record<Justification, Justify | undefined> = {
  start: 'start',
  center: 'center',
  end: 'end',
  between: 'between',
  around: 'around',
  evenly: 'evenly',
  stretch: undefined,
};

export function resolveAlign(value: Alignment | undefined): Align | undefined {
  return value === undefined ? undefined : ALIGN_MAP[value];
}

export function resolveJustify(
  value: Justification | undefined,
): Justify | undefined {
  return value === undefined ? undefined : JUSTIFY_MAP[value];
}

export function resolveDirection(
  value: FlexDirection | undefined,
): 'row' | 'col' | undefined {
  return value === 'row' ? 'row' : value === 'col' ? 'col' : undefined;
}

export function resolveWrap(value: FlexWrap | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value !== 'nowrap';
}

function isThemeColor(value: Color): value is ThemeColor {
  return typeof value === 'object' && value !== null;
}

export function resolveColor(value: Color, scheme: Scheme): string {
  if (isThemeColor(value)) return value[scheme];
  return resolveColorToken(value, scheme);
}

export function resolveOptionalColor(
  value: Color | undefined,
  scheme: Scheme,
): string | undefined {
  return value === undefined ? undefined : resolveColor(value, scheme);
}

export function resolveRadius(
  value: RadiusValue | undefined,
): number | string | undefined {
  if (value === undefined) return undefined;
  return isRadiusValue(value) ? resolveBoxRadius(value) : value;
}

export function resolveSpacing(
  value: SpacingValue | undefined,
  prefix: 'padding' | 'margin',
): StyleEntries {
  const s: StyleEntries = {};
  if (value === undefined) return s;
  const top = `${prefix}Top`;
  const right = `${prefix}Right`;
  const bottom = `${prefix}Bottom`;
  const left = `${prefix}Left`;
  if (typeof value === 'number' || typeof value === 'string') {
    s[top] = value;
    s[right] = value;
    s[bottom] = value;
    s[left] = value;
    return s;
  }
  if (value.x !== undefined) {
    s[left] = value.x;
    s[right] = value.x;
  }
  if (value.y !== undefined) {
    s[top] = value.y;
    s[bottom] = value.y;
  }
  if (value.top !== undefined) s[top] = value.top;
  if (value.right !== undefined) s[right] = value.right;
  if (value.bottom !== undefined) s[bottom] = value.bottom;
  if (value.left !== undefined) s[left] = value.left;
  return s;
}

function borderSide(side: number | Border, scheme: Scheme): StyleEntries {
  if (typeof side === 'number') return { width: side };
  const s: StyleEntries = {};
  if (side.size !== undefined) s.width = side.size;
  if (side.color !== undefined) s.color = resolveColor(side.color, scheme);
  if (side.style !== undefined) s.style = side.style;
  return s;
}

export interface ResolvedBorders {
  top?: StyleEntries;
  right?: StyleEntries;
  bottom?: StyleEntries;
  left?: StyleEntries;
}

function isBorder(value: Border | Borders): value is Border {
  return 'size' in value || 'color' in value || 'style' in value;
}

export function resolveBorder(
  value: BorderValue | undefined,
  scheme: Scheme,
): ResolvedBorders {
  if (value === undefined) return {};
  if (typeof value === 'number') {
    const all = { width: value };
    return { top: all, right: all, bottom: all, left: all };
  }
  if (isBorder(value)) {
    const all = borderSide(value, scheme);
    return { top: all, right: all, bottom: all, left: all };
  }
  const out: ResolvedBorders = {};
  const sides = value;
  if (sides.x !== undefined) {
    out.left = borderSide(sides.x, scheme);
    out.right = borderSide(sides.x, scheme);
  }
  if (sides.y !== undefined) {
    out.top = borderSide(sides.y, scheme);
    out.bottom = borderSide(sides.y, scheme);
  }
  if (sides.top !== undefined) out.top = borderSide(sides.top, scheme);
  if (sides.right !== undefined) out.right = borderSide(sides.right, scheme);
  if (sides.bottom !== undefined) out.bottom = borderSide(sides.bottom, scheme);
  if (sides.left !== undefined) out.left = borderSide(sides.left, scheme);
  return out;
}

const WEIGHT_FAMILY: Record<FontWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

export function resolveWeight(
  value: FontWeight | undefined,
): string | undefined {
  return value === undefined ? undefined : WEIGHT_FAMILY[value];
}

const BADGE_COLOR_TOKEN: Record<BadgeColor, KitButtonColor> = {
  secondary: 'secondary',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  discovery: 'discovery',
};

export function resolveBadgeColor(
  value: BadgeColor | undefined,
): KitButtonColor {
  return value === undefined ? 'secondary' : BADGE_COLOR_TOKEN[value];
}

export function resolveButtonColor(
  value: ButtonColor | undefined,
): KitButtonColor {
  return value ?? 'primary';
}

export function resolveButtonVariant(
  value: ControlVariant | undefined,
): ButtonControlVariant {
  return value ?? 'solid';
}

export function resolveControlSize(
  value: KitControlSize | undefined,
): KitControlSize {
  return value ?? 'md';
}

export function resolveFieldVariant(
  value: FieldVariant | undefined,
): KitControlVariant {
  return value ?? 'outline';
}

export interface ResolvedPosition {
  position: Position;
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  left?: Dimension;
  zIndex?: number;
}

export interface PositionLike {
  position?: unknown;
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  left?: Dimension;
  inset?: Dimension;
  zIndex?: number;
}

function readPositionFields(node: WidgetNode): PositionFields {
  const fields = node as PositionLike;
  const position =
    fields.position === 'absolute' || fields.position === 'relative'
      ? fields.position
      : undefined;
  return {
    position,
    top: fields.top,
    right: fields.right,
    bottom: fields.bottom,
    left: fields.left,
    inset: fields.inset,
    zIndex: fields.zIndex,
  };
}

export function hasPositioning(node: WidgetNode): boolean {
  const p = readPositionFields(node);
  return (
    p.position !== undefined ||
    p.top !== undefined ||
    p.right !== undefined ||
    p.bottom !== undefined ||
    p.left !== undefined ||
    p.inset !== undefined ||
    p.zIndex !== undefined
  );
}

export function resolvePosition(node: WidgetNode): ResolvedPosition {
  const p = readPositionFields(node);
  const inset = p.inset;
  return {
    position: p.position ?? (hasPositioning(node) ? 'absolute' : 'relative'),
    top: p.top ?? inset,
    right: p.right ?? inset,
    bottom: p.bottom ?? inset,
    left: p.left ?? inset,
    zIndex: p.zIndex,
  };
}
