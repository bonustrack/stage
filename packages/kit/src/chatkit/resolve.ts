
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
  Color,
  ControlVariant,
  FieldVariant,
  FlexDirection,
  FlexWrap,
  FontWeight,
  Justification,
  RadiusValue,
  SpacingValue,
  ThemeColor,
} from './node-fields';

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
