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
export interface BoxProps {
  direction?: Direction;
  gap?: number;
  /** all-sides padding */
  padding?: number;
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pr?: number;
  pb?: number;
  pl?: number;
  /** all-sides margin */
  margin?: number;
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mr?: number;
  mb?: number;
  ml?: number;
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

  // Padding: shorthand first, per-side/axis override after (precedence:
  // per-side > axis (px/py) > all-sides (p/padding)).
  const pAll = props.padding ?? props.p;
  if (pAll !== undefined) out.padding = pAll;
  if (props.px !== undefined) {
    out.paddingLeft = props.px;
    out.paddingRight = props.px;
  }
  if (props.py !== undefined) {
    out.paddingTop = props.py;
    out.paddingBottom = props.py;
  }
  if (props.pt !== undefined) out.paddingTop = props.pt;
  if (props.pr !== undefined) out.paddingRight = props.pr;
  if (props.pb !== undefined) out.paddingBottom = props.pb;
  if (props.pl !== undefined) out.paddingLeft = props.pl;

  // Margin: same precedence model.
  const mAll = props.margin ?? props.m;
  if (mAll !== undefined) out.margin = mAll;
  if (props.mx !== undefined) {
    out.marginLeft = props.mx;
    out.marginRight = props.mx;
  }
  if (props.my !== undefined) {
    out.marginTop = props.my;
    out.marginBottom = props.my;
  }
  if (props.mt !== undefined) out.marginTop = props.mt;
  if (props.mr !== undefined) out.marginRight = props.mr;
  if (props.mb !== undefined) out.marginBottom = props.mb;
  if (props.ml !== undefined) out.marginLeft = props.ml;

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
