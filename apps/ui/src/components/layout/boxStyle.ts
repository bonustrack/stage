/** @file Shared prop contract and pure CSS-style mapper for the Box/Row/Col layout primitives, kept in lock-step with the React Native implementation in apps/app. */

import { colors, resolveBoxRadius, type RadiusValue } from '@metro-labs/kit';

type Direction = 'row' | 'col';
type Size = number | string;
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

/** Per-side / per-axis spacing object for the Box/Row/Col prop API (mirrors ChatKit's `Spacing`): `x` -> left+right, `y` -> top+bottom, per-side keys override the axis. */
interface Spacing {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  x?: number | string;
  y?: number | string;
}

export interface BoxProps {
  direction?: Direction;
  gap?: number;
  /** padding: scalar (all sides) or per-side/axis `Spacing` object. */
  padding?: number | string | Spacing;
  /** margin: scalar (all sides) or per-side/axis `Spacing` object. */
  margin?: number | string | Spacing;
  align?: Align;
  justify?: Justify;
  flex?: number;
  wrap?: boolean;
  /** ChatKit `background`: a kit `colors` key (resolved to hex) or a raw colour. */
  background?: string;
  /** ChatKit `radius` token enum ('none'|'2xs'|..|'4xl'|'full'|'100%'). */
  radius?: RadiusValue | (string & {});
  /** ChatKit BlockProps sizing. */
  width?: Size;
  height?: Size;
  size?: Size;
  minWidth?: Size;
  minHeight?: Size;
  maxWidth?: Size;
  maxHeight?: Size;
  aspectRatio?: number | string;
}

const ALIGN_MAP: Record<Align, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY_MAP: Record<Justify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

/** Resolve `bg`: kit color-token key -> hex, else pass through literal. */
function resolveBg(bg: string): string {
  return (colors as Record<string, string>)[bg] ?? bg;
}

/** Expand a `padding`/`margin` prop into per-side entries. A scalar sets all four sides; a `Spacing` object resolves x -> left+right, y -> top+bottom, then per-side keys (top/right/bottom/left) override the axis. */
function applySpacing(
  out: Record<string, string | number>,
  prefix: 'padding' | 'margin',
  value: number | string | Spacing | undefined,
): void {
  if (value === undefined) return;
  const Top = `${prefix}Top`;
  const Right = `${prefix}Right`;
  const Bottom = `${prefix}Bottom`;
  const Left = `${prefix}Left`;

  if (typeof value === 'number' || typeof value === 'string') {
    out[Top] = value;
    out[Right] = value;
    out[Bottom] = value;
    out[Left] = value;
    return;
  }

  if (value.x !== undefined) {
    out[Left] = value.x;
    out[Right] = value.x;
  }
  if (value.y !== undefined) {
    out[Top] = value.y;
    out[Bottom] = value.y;
  }
  if (value.top !== undefined) out[Top] = value.top;
  if (value.right !== undefined) out[Right] = value.right;
  if (value.bottom !== undefined) out[Bottom] = value.bottom;
  if (value.left !== undefined) out[Left] = value.left;
}

/** Emit flex/visual layout entries (direction, gap, alignment, background, radius). */
function applyFlexEntries(
  out: Record<string, string | number>,
  props: BoxProps,
): void {
  out.flexDirection = props.direction === 'row' ? 'row' : 'column';
  if (props.gap !== undefined) out.gap = props.gap;
  if (props.align !== undefined) out.alignItems = ALIGN_MAP[props.align];
  if (props.justify !== undefined)
    out.justifyContent = JUSTIFY_MAP[props.justify];
  if (props.flex !== undefined) out.flex = props.flex;
  if (props.wrap !== undefined) out.flexWrap = props.wrap ? 'wrap' : 'nowrap';
  if (props.background !== undefined)
    out.backgroundColor = resolveBg(props.background);
  if (props.radius !== undefined)
    out.borderRadius = resolveBoxRadius(props.radius);
}

/** Emit sizing entries (size/width/height/min/max/aspectRatio); `size` sets both width and height. */
function applySizing(
  out: Record<string, string | number>,
  props: BoxProps,
): void {
  if (props.size !== undefined) {
    out.width = props.size;
    out.height = props.size;
  }
  if (props.width !== undefined) out.width = props.width;
  if (props.height !== undefined) out.height = props.height;
  if (props.minWidth !== undefined) out.minWidth = props.minWidth;
  if (props.minHeight !== undefined) out.minHeight = props.minHeight;
  if (props.maxWidth !== undefined) out.maxWidth = props.maxWidth;
  if (props.maxHeight !== undefined) out.maxHeight = props.maxHeight;
  if (props.aspectRatio !== undefined) out.aspectRatio = props.aspectRatio;
}

/** Pure mapper: BoxProps -> neutral CSS-ish record; undefined props are omitted and `display` is added by the web renderer. */
function boxStyleEntries(
  props: BoxProps,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  applyFlexEntries(out, props);
  applySpacing(out, 'padding', props.padding);
  applySpacing(out, 'margin', props.margin);
  applySizing(out, props);
  return out;
}

/** Web-specific: stringify numeric entries to `${n}px` and add display:flex. This is the single place units are baked for the Vue renderer. */
export function boxInlineStyle(props: BoxProps): Record<string, string> {
  const entries = boxStyleEntries(props);
  const css: Record<string, string> = { display: 'flex' };
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}
