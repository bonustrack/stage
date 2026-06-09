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

import {
  colors,
  resolveBoxRadius,
  type ColorToken,
  type RadiusValue,
} from './tokens';

export type { RadiusValue };

/** ChatKit BlockProps sizing value: a number (px) or a string ('50%', 'auto'). */
export type Size = number | string;

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
  /** ChatKit `background`: a semantic ColorToken (resolved scheme-aware via the
   *  Box renderer), a kit `colors` scale key (resolved to hex), or a raw colour
   *  string (escape hatch). Maps to style.backgroundColor. */
  background?: ColorToken | (string & {});
  /** ChatKit `radius`: a token from the corner-radius scale
   *  ('none'|'2xs'|..|'4xl'|'full'|'100%'). Maps to style.borderRadius. A raw
   *  string ('12px') OR a raw number passes through as the escape hatch - used
   *  for the app's live, user-overridable `blockRadius` (radiusOverride store),
   *  whose px value is dynamic and has no fixed token. Mirrors how `background`
   *  / Text `color` accept a raw value alongside the token. */
  radius?: RadiusValue | number | (string & {});
  /** ChatKit BlockProps sizing (number=px | string='50%'/'auto'). */
  width?: Size;
  height?: Size;
  /** `size` sets BOTH width and height (ChatKit semantics). */
  size?: Size;
  minWidth?: Size;
  minHeight?: Size;
  maxWidth?: Size;
  maxHeight?: Size;
  aspectRatio?: number | string;
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

/** Resolve a `background` value's `colors`-scale layer: a kit `colors` key ->
 *  hex, otherwise pass through. (Semantic ColorToken -> scheme colour is done
 *  upstream in the Box renderer, which knows the active scheme; this pure module
 *  has no scheme.) */
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
  if (props.background !== undefined) s.backgroundColor = resolveBg(props.background);
  if (props.radius !== undefined) s.borderRadius = resolveBoxRadius(props.radius);

  // ChatKit BlockProps sizing. `size` sets both axes; explicit width/height win.
  if (props.size !== undefined) {
    s.width = props.size;
    s.height = props.size;
  }
  if (props.width !== undefined) s.width = props.width;
  if (props.height !== undefined) s.height = props.height;
  if (props.minWidth !== undefined) s.minWidth = props.minWidth;
  if (props.minHeight !== undefined) s.minHeight = props.minHeight;
  if (props.maxWidth !== undefined) s.maxWidth = props.maxWidth;
  if (props.maxHeight !== undefined) s.maxHeight = props.maxHeight;
  if (props.aspectRatio !== undefined) s.aspectRatio = props.aspectRatio;

  return s;
}
