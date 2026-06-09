/** Shared prop contract + pure style mapper for the Box/Row/Col layout
 *  primitives. Prop names are kept in lock-step with the React Native
 *  implementation (apps/app) so the API can't drift across platforms.
 *
 *  Numbers mean px on both platforms. This module returns a neutral record
 *  of CSS-ish keys; the Vue renderer stringifies numeric values to `${n}px`,
 *  while a RN renderer would pass the numbers straight into a ViewStyle. */

import { colors } from '@metro-labs/kit';

export type Direction = 'row' | 'col';
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

/** Prop API shared by Box/Row/Col. Row/Col omit `direction`. */
/** Per-side / per-axis spacing object, mirroring OpenAI ChatKit's `Spacing`.
 *  `x` -> left+right, `y` -> top+bottom; per-side keys override the axis. */
export interface Spacing {
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
  /** raw color string, or a key from kit `colors` (e.g. 'bg-dark') */
  bg?: string;
  radius?: number;
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

/** Expand a `padding`/`margin` prop into per-side entries. A scalar sets all
 *  four sides; a `Spacing` object resolves x -> left+right, y -> top+bottom,
 *  then per-side keys (top/right/bottom/left) override the axis. */
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

/** Pure mapper: BoxProps -> neutral CSS-ish record. Numbers stay numbers;
 *  string values (flexDirection, alignItems, colors...) stay strings.
 *  Any undefined prop is omitted so it never overrides a default or a
 *  passthrough style. `display` is NOT emitted here — the web renderer
 *  adds `display:flex` explicitly (RN Views are flex by default). */
export function boxStyleEntries(
  props: BoxProps,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  out.flexDirection = props.direction === 'row' ? 'row' : 'column';

  if (props.gap !== undefined) out.gap = props.gap;

  applySpacing(out, 'padding', props.padding);
  applySpacing(out, 'margin', props.margin);

  if (props.align !== undefined) out.alignItems = ALIGN_MAP[props.align];
  if (props.justify !== undefined)
    out.justifyContent = JUSTIFY_MAP[props.justify];
  if (props.flex !== undefined) out.flex = props.flex;
  if (props.wrap !== undefined) out.flexWrap = props.wrap ? 'wrap' : 'nowrap';
  if (props.bg !== undefined) out.backgroundColor = resolveBg(props.bg);
  if (props.radius !== undefined) out.borderRadius = props.radius;

  return out;
}

/** Web-specific: stringify numeric entries to `${n}px` and add display:flex.
 *  This is the single place units are baked for the Vue renderer. */
export function boxInlineStyle(props: BoxProps): Record<string, string> {
  const entries = boxStyleEntries(props);
  const css: Record<string, string> = { display: 'flex' };
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}
