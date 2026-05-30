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

/** The framework-agnostic prop contract. Renderers extend this with their own
 *  passthrough typing (RN: ViewProps + `style`; Vue: `class` + `as`). */
export interface BoxBaseProps {
  /** flex axis. 'col' -> column (default), 'row' -> row. */
  direction?: 'row' | 'col';
  /** gap between children, px. */
  gap?: number;
  /** padding, all sides, px. */
  padding?: number;
  /** alias of `padding`. */
  p?: number;
  /** horizontal padding (left+right), px. Wins over `p`/`padding` on the x axis. */
  px?: number;
  /** vertical padding (top+bottom), px. Wins over `p`/`padding` on the y axis. */
  py?: number;
  /** per-side padding, px. Wins over px/py and p/padding. */
  pt?: number;
  pr?: number;
  pb?: number;
  pl?: number;
  /** margin, all sides, px. */
  margin?: number;
  /** alias of `margin`. */
  m?: number;
  /** horizontal margin (left+right), px. */
  mx?: number;
  /** vertical margin (top+bottom), px. */
  my?: number;
  /** per-side margin, px. */
  mt?: number;
  mr?: number;
  mb?: number;
  ml?: number;
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

/** Pure prop -> style mapping. The SINGLE source of layout logic. Omits any
 *  key whose prop is undefined so it never overrides a renderer default or a
 *  passthrough style. Precedence: per-side (pt/pr/pb/pl, mt/...) > axis
 *  (px/py, mx/my) > shorthand (p/padding, m/margin). */
export function boxStyleEntries(props: BoxBaseProps): BoxStyleEntries {
  const s: BoxStyleEntries = {};

  s.flexDirection = props.direction === 'row' ? 'row' : 'column';

  if (props.gap !== undefined) s.gap = props.gap;

  // Padding: shorthand, then axis, then per-side (later writes win).
  const pAll = props.p ?? props.padding;
  if (pAll !== undefined) {
    s.paddingTop = pAll;
    s.paddingRight = pAll;
    s.paddingBottom = pAll;
    s.paddingLeft = pAll;
  }
  if (props.px !== undefined) {
    s.paddingLeft = props.px;
    s.paddingRight = props.px;
  }
  if (props.py !== undefined) {
    s.paddingTop = props.py;
    s.paddingBottom = props.py;
  }
  if (props.pt !== undefined) s.paddingTop = props.pt;
  if (props.pr !== undefined) s.paddingRight = props.pr;
  if (props.pb !== undefined) s.paddingBottom = props.pb;
  if (props.pl !== undefined) s.paddingLeft = props.pl;

  // Margin: same precedence.
  const mAll = props.m ?? props.margin;
  if (mAll !== undefined) {
    s.marginTop = mAll;
    s.marginRight = mAll;
    s.marginBottom = mAll;
    s.marginLeft = mAll;
  }
  if (props.mx !== undefined) {
    s.marginLeft = props.mx;
    s.marginRight = props.mx;
  }
  if (props.my !== undefined) {
    s.marginTop = props.my;
    s.marginBottom = props.my;
  }
  if (props.mt !== undefined) s.marginTop = props.mt;
  if (props.mr !== undefined) s.marginRight = props.mr;
  if (props.mb !== undefined) s.marginBottom = props.mb;
  if (props.ml !== undefined) s.marginLeft = props.ml;

  if (props.align !== undefined) s.alignItems = ALIGN[props.align];
  if (props.justify !== undefined) s.justifyContent = JUSTIFY[props.justify];
  if (props.flex !== undefined) s.flex = props.flex;
  if (props.wrap !== undefined) s.flexWrap = props.wrap ? 'wrap' : 'nowrap';
  if (props.bg !== undefined) s.backgroundColor = resolveBg(props.bg);
  if (props.radius !== undefined) s.borderRadius = props.radius;

  return s;
}
