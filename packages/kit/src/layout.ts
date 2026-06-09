/** Shared layout-primitive contract for the Metro clients.
 *
 *  This module holds the SINGLE SOURCE OF TRUTH for the Box/Row/Col prop API
 *  and the prop -> style mapping. It is pure data + a pure function — no
 *  framework deps — so both renderers consume identical names and mapping:
 *    - apps/app (React Native) spreads `boxStyleEntries(props)` into a ViewStyle
 *      (numbers pass straight through; RN treats unitless numbers as px).
 *    - apps/ui (Vue) maps the same record to inline CSS, stringifying numeric
 *      values to `${n}px`.
 *
 *  The contract: every spacing/size number = px on BOTH platforms. The mapper
 *  returns NEUTRAL values (raw numbers, CSS-ish string enums like 'flex-start'
 *  / 'row'); it never bakes units and never emits `display` (RN Views are flex
 *  by default; web must add display:flex itself — each renderer owns that). */

import { colors } from './tokens';

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

/** Per-side / per-axis spacing object, mirroring OpenAI ChatKit's `Spacing`.
 *  `x` -> horizontal (left+right), `y` -> vertical (top+bottom); `top`/`right`/
 *  `bottom`/`left` target a single side. Per-side keys override the axis keys
 *  (RN applies paddingHorizontal/Vertical first, then the specific side wins).
 *  Each value is a number (px) or a string (passthrough). */
export interface Spacing {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  x?: number | string;
  y?: number | string;
}

/** The framework-agnostic prop contract. Renderers extend this with their own
 *  passthrough typing (RN: ViewProps + `style`; Vue: `class` + `as`).
 *  Spacing props match ChatKit 1:1: `padding`/`margin` accept a scalar (all
 *  sides) or a `Spacing` object. No letter shorthands. */
export interface BoxBaseProps {
  /** flex axis. 'col' -> column (default), 'row' -> row. */
  direction?: 'row' | 'col';
  /** gap between children, px. */
  gap?: number;
  /** padding: scalar (all sides) or per-side/axis `Spacing` object. */
  padding?: number | string | Spacing;
  /** margin: scalar (all sides) or per-side/axis `Spacing` object. */
  margin?: number | string | Spacing;
  /** cross-axis alignment. */
  align?: Align;
  /** main-axis distribution. */
  justify?: Justify;
  /** flex grow/shorthand, e.g. flex={1}. */
  flex?: number;
  /** wrap children (default false). */
  wrap?: boolean;
  /** background colour — a key from kit `colors` (resolved to hex) or a literal colour. */
  bg?: string;
  /** border radius, px. */
  radius?: number;
}

const ALIGN: Record<Align, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY: Record<Justify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

/** Resolve `bg`: if it matches a key in kit `colors`, return the hex;
 *  otherwise pass through as a literal colour string. */
export function resolveBg(bg: string): string {
  return (colors as Record<string, string>)[bg] ?? bg;
}

/** A neutral, CSS-ish record of style entries. Values are raw numbers (px) or
 *  string enums. Consumed by both renderers. `display` is intentionally absent. */
export type BoxStyleEntries = Record<string, string | number>;

/** Expand a `padding`/`margin` prop into per-side style entries under the
 *  given key prefix ('padding' | 'margin'). A scalar (number|string) sets all
 *  four sides. A `Spacing` object resolves x -> left+right, y -> top+bottom,
 *  then per-side keys (top/right/bottom/left) override the axis (later writes
 *  win), matching RN's paddingHorizontal/Vertical-then-side precedence. */
function applySpacing(
  s: BoxStyleEntries,
  prefix: 'padding' | 'margin',
  value: number | string | Spacing | undefined,
): void {
  if (value === undefined) return;
  const Top = `${prefix}Top`;
  const Right = `${prefix}Right`;
  const Bottom = `${prefix}Bottom`;
  const Left = `${prefix}Left`;

  if (typeof value === 'number' || typeof value === 'string') {
    s[Top] = value;
    s[Right] = value;
    s[Bottom] = value;
    s[Left] = value;
    return;
  }

  if (value.x !== undefined) {
    s[Left] = value.x;
    s[Right] = value.x;
  }
  if (value.y !== undefined) {
    s[Top] = value.y;
    s[Bottom] = value.y;
  }
  if (value.top !== undefined) s[Top] = value.top;
  if (value.right !== undefined) s[Right] = value.right;
  if (value.bottom !== undefined) s[Bottom] = value.bottom;
  if (value.left !== undefined) s[Left] = value.left;
}

/** Pure prop -> style mapping. The SINGLE source of layout logic. Omits any
 *  key whose prop is undefined so it never overrides a renderer default or a
 *  passthrough style. `padding`/`margin` accept a scalar (all sides) or a
 *  `Spacing` object (per-side wins over axis). */
export function boxStyleEntries(props: BoxBaseProps): BoxStyleEntries {
  const s: BoxStyleEntries = {};

  s.flexDirection = props.direction === 'row' ? 'row' : 'column';

  if (props.gap !== undefined) s.gap = props.gap;

  applySpacing(s, 'padding', props.padding);
  applySpacing(s, 'margin', props.margin);

  if (props.align !== undefined) s.alignItems = ALIGN[props.align];
  if (props.justify !== undefined) s.justifyContent = JUSTIFY[props.justify];
  if (props.flex !== undefined) s.flex = props.flex;
  if (props.wrap !== undefined) s.flexWrap = props.wrap ? 'wrap' : 'nowrap';
  if (props.bg !== undefined) s.backgroundColor = resolveBg(props.bg);
  if (props.radius !== undefined) s.borderRadius = props.radius;

  return s;
}
