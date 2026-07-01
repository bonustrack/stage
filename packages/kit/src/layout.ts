
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

export interface ResolvedBoxBorderSide {
  width?: number | string;
  color?: string;
  style?: string;
}

export interface ResolvedBoxBorder {
  top?: ResolvedBoxBorderSide;
  right?: ResolvedBoxBorderSide;
  bottom?: ResolvedBoxBorderSide;
  left?: ResolvedBoxBorderSide;
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
  border?: ResolvedBoxBorder;
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

function applyBorderSide(
  s: BoxStyleEntries,
  side: ResolvedBoxBorderSide | undefined,
  widthKey: string,
  colorKey: string,
): void {
  if (side === undefined) return;
  setIf(s, widthKey, side.width);
  setIf(s, colorKey, side.color);
}

function applyBorder(s: BoxStyleEntries, border: ResolvedBoxBorder | undefined): void {
  if (border === undefined) return;
  applyBorderSide(s, border.top, 'borderTopWidth', 'borderTopColor');
  applyBorderSide(s, border.right, 'borderRightWidth', 'borderRightColor');
  applyBorderSide(s, border.bottom, 'borderBottomWidth', 'borderBottomColor');
  applyBorderSide(s, border.left, 'borderLeftWidth', 'borderLeftColor');
  const style =
    border.top?.style ??
    border.right?.style ??
    border.bottom?.style ??
    border.left?.style;
  setIf(s, 'borderStyle', style);
}

export function borderStyleEntries(
  border: ResolvedBoxBorder | undefined,
): BoxStyleEntries {
  const s: BoxStyleEntries = {};
  applyBorder(s, border);
  return s;
}

export function boxStyleEntries(props: BoxBaseProps): BoxStyleEntries {
  const s: BoxStyleEntries = {};
  applyFlex(s, props);
  applySpacing(s, 'padding', props.padding);
  applySpacing(s, 'margin', props.margin);
  applySizing(s, props);
  applyBorder(s, props.border);
  return s;
}

export type Surface = 'none' | 'surface' | 'raised' | 'sunken' | 'toolbar';

export interface SurfacePalette {
  bg: string;
  inputBg: string;
  toolbarBg: string;
}

export function surfaceColor(surface: Surface, palette: SurfacePalette): string | undefined {
  switch (surface) {
    case 'surface':
      return palette.bg;
    case 'raised':
      return palette.inputBg;
    case 'sunken':
      return palette.bg;
    case 'toolbar':
      return palette.toolbarBg;
    default:
      return undefined;
  }
}
