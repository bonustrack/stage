
import {
  colors,
  resolveBoxRadius,
  type ColorToken,
  type RadiusValue,
} from './tokens';

export type { RadiusValue };

export type Size = number | string;

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

export interface Spacing {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  x?: number | string;
  y?: number | string;
}

export interface BoxBaseProps {
  direction?: 'row' | 'col';
  gap?: number;
  padding?: number | string | Spacing;
  margin?: number | string | Spacing;
  align?: Align;
  justify?: Justify;
  flex?: number;
  wrap?: boolean;
  background?: ColorToken | (string & {});
  radius?: RadiusValue | number | (string & {});
  width?: Size;
  height?: Size;
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

export function resolveBg(bg: string): string {
  return (colors as Record<string, string>)[bg] ?? bg;
}

export type BoxStyleEntries = Record<string, string | number>;

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

function setIf(s: BoxStyleEntries, key: string, value: string | number | undefined): void {
  if (value !== undefined) s[key] = value;
}

function applyFlex(s: BoxStyleEntries, props: BoxBaseProps): void {
  s.flexDirection = props.direction === 'row' ? 'row' : 'column';
  setIf(s, 'gap', props.gap);
  if (props.align !== undefined) s.alignItems = ALIGN[props.align];
  if (props.justify !== undefined) s.justifyContent = JUSTIFY[props.justify];
  setIf(s, 'flex', props.flex);
  if (props.wrap !== undefined) s.flexWrap = props.wrap ? 'wrap' : 'nowrap';
  if (props.background !== undefined) s.backgroundColor = resolveBg(props.background);
  if (props.radius !== undefined) s.borderRadius = resolveBoxRadius(props.radius);
}

function applySizing(s: BoxStyleEntries, props: BoxBaseProps): void {
  if (props.size !== undefined) {
    s.width = props.size;
    s.height = props.size;
  }
  setIf(s, 'width', props.width);
  setIf(s, 'height', props.height);
  setIf(s, 'minWidth', props.minWidth);
  setIf(s, 'minHeight', props.minHeight);
  setIf(s, 'maxWidth', props.maxWidth);
  setIf(s, 'maxHeight', props.maxHeight);
  setIf(s, 'aspectRatio', props.aspectRatio);
}

export function boxStyleEntries(props: BoxBaseProps): BoxStyleEntries {
  const s: BoxStyleEntries = {};
  applyFlex(s, props);
  applySpacing(s, 'padding', props.padding);
  applySpacing(s, 'margin', props.margin);
  applySizing(s, props);
  return s;
}
