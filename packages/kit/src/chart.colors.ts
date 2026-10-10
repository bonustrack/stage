import { isColorToken, resolveColorToken, type Scheme, type ThemeColor } from './tokens';

export const CHART_COLORS = ['blue', 'purple', 'orange', 'green', 'red', 'yellow', 'pink'] as const;

export type ChartColorName = (typeof CHART_COLORS)[number];

export type ChartColor = string | ThemeColor;

const HUE_SHADES: readonly number[] = [25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000];

const HUE_RAMPS: Record<ChartColorName, readonly string[]> = {
  blue: ['#f5faff', '#e5f3ff', '#cce6ff', '#99ceff', '#66b5ff', '#339cff', '#0285ff', '#0169cc', '#004f99', '#003f7a', '#013566', '#00284d', '#000e1a', '#000d19'],
  purple: ['#f9f5fe', '#efe5fe', '#e0cefd', '#ceb0fb', '#be95fa', '#ad7bf9', '#924ff7', '#8046d9', '#6b3ab4', '#532d8d', '#3f226a', '#2c184a', '#160c25', '#100a19'],
  orange: ['#fff5f0', '#ffe7d9', '#ffcfb4', '#ffb790', '#ff9e6c', '#ff8549', '#fb6a22', '#e25507', '#b9480d', '#923b0f', '#6d2e0f', '#4a2206', '#281105', '#211107'],
  green: ['#edfaf2', '#d9f4e4', '#b8ebcc', '#8cdfad', '#66d492', '#40c977', '#04b84c', '#00a240', '#008635', '#00692a', '#004f1f', '#003716', '#011c0b', '#001207'],
  red: ['#fff0f0', '#ffd9d9', '#ffc6c5', '#ffa4a2', '#ff8583', '#ff6764', '#fa423e', '#e02e2a', '#ba2623', '#911e1b', '#6e1615', '#4d100e', '#280b0a', '#1f0909'],
  yellow: ['#fffbed', '#fff6d9', '#ffeeb8', '#ffe48c', '#ffdb66', '#ffd240', '#ffc300', '#e0ac00', '#ba8e00', '#916f00', '#6e5400', '#4d3b00', '#261d00', '#1a1400'],
  pink: ['#fff4f9', '#ffe8f3', '#ffd4e8', '#ffbada', '#ffa3ce', '#ff8cc1', '#ff66ad', '#e04c91', '#ba437a', '#963c67', '#6e2c4a', '#4d1f34', '#29101c', '#1a0a11'],
};

const GRAY_SHADES: readonly number[] = [
  0, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 925, 950, 975, 1000,
];

const GRAY_RAMPS: Record<Scheme, readonly string[]> = {
  light: [
    '#ffffff', '#fcfcfc', '#f9f9f9', '#f3f3f3', '#ededed', '#dfdfdf', '#cdcdcd', '#b9b9b9', '#afafaf', '#9f9f9f', '#8f8f8f',
    '#767676', '#5d5d5d', '#4f4f4f', '#414141', '#393939', '#303030', '#282828', '#212121', '#1c1c1c', '#181818', '#161616',
    '#131313', '#101010', '#0d0d0d',
  ],
  dark: [
    '#0d0d0d', '#101010', '#131313', '#161616', '#181818', '#1c1c1c', '#212121', '#282828', '#303030', '#393939', '#414141',
    '#4f4f4f', '#5d5d5d', '#767676', '#8f8f8f', '#9f9f9f', '#afafaf', '#b9b9b9', '#cdcdcd', '#dcdcdc', '#ededed', '#f3f3f3',
    '#f3f3f3', '#f9f9f9', '#ffffff',
  ],
};

const HUE_TINTS: Readonly<Record<string, number>> = { a25: 0.04, a50: 0.13, a75: 0.25, a100: 0.4, a200: 0.6, a300: 0.8 };

const ALPHA_BASE: Record<Scheme, string> = { light: '#0d0d0d', dark: '#ffffff' };

const PRIMITIVE = /^(?:white|black|alpha-\d{1,3}|(?:gray|green|red|pink|orange|yellow|purple|blue)-(?:\d{1,4}|a\d{1,3}))$/;

const CYCLE_SHADES: readonly number[] = [400, 500, 600, 300, 200];

const SHARED_SHADES: readonly number[] = [500, 200, 400, 600, 300];

const DEFAULT_SHADE = 400;

export function isChartColorName(value: string): value is ChartColorName {
  return (CHART_COLORS as readonly string[]).includes(value);
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(1, alpha)})`;
}

function hueShade(name: ChartColorName, shade: number): string {
  const ramp = HUE_RAMPS[name];
  return ramp[HUE_SHADES.indexOf(shade)] ?? ramp[HUE_SHADES.indexOf(DEFAULT_SHADE)] ?? '#000000';
}

function rampColor(name: string, step: string, scheme: Scheme): string | undefined {
  if (name === 'gray') return GRAY_RAMPS[scheme][GRAY_SHADES.indexOf(Number(step))];
  if (!isChartColorName(name)) return undefined;
  const tint = Object.hasOwn(HUE_TINTS, step) ? HUE_TINTS[step] : undefined;
  if (tint !== undefined) return withAlpha(hueShade(name, DEFAULT_SHADE), tint);
  return HUE_SHADES.includes(Number(step)) ? hueShade(name, Number(step)) : undefined;
}

export function chartPrimitiveColor(token: string, scheme: Scheme): string | undefined {
  if (!PRIMITIVE.test(token)) return undefined;
  if (token === 'white') return '#ffffff';
  if (token === 'black') return '#000000';
  const [name = '', step = ''] = token.split('-');
  if (name === 'alpha') return withAlpha(ALPHA_BASE[scheme], Number(step) / 100);
  return rampColor(name, step, scheme);
}

export function isChartColorToken(value: string): boolean {
  return isChartColorName(value) || chartPrimitiveColor(value, 'light') !== undefined;
}

export function chartCategoryColor(index: number): string {
  const name = CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
  return hueShade(name, CYCLE_SHADES[Math.floor(index / CHART_COLORS.length) % CYCLE_SHADES.length] ?? DEFAULT_SHADE);
}

function pickScheme(color: ChartColor | undefined, scheme: Scheme): string | undefined {
  if (color === undefined) return undefined;
  return typeof color === 'string' ? color : color[scheme];
}

function solidColor(value: string, scheme: Scheme): string {
  const primitive = chartPrimitiveColor(value, scheme);
  if (primitive !== undefined) return primitive;
  return isColorToken(value) ? resolveColorToken(value, scheme) : value;
}

function nextColor(last: ChartColorName | undefined): ChartColorName {
  if (last === undefined) return CHART_COLORS[0];
  return CHART_COLORS[(CHART_COLORS.indexOf(last) + 1) % CHART_COLORS.length] ?? CHART_COLORS[0];
}

export function chartSeriesColors(colors: readonly (ChartColor | undefined)[], scheme: Scheme): string[] {
  const picked = colors.map((c) => pickScheme(c, scheme));
  const shared = picked.every((c) => c === picked[0]) ? picked[0] : undefined;
  const used = new Map<ChartColorName, number>();
  let last: ChartColorName | undefined;
  const take = (name: ChartColorName, shades: readonly number[], skip = 0): string => {
    const count = (used.get(name) ?? 0) + skip;
    used.set(name, count + 1);
    return hueShade(name, shades[count % shades.length] ?? DEFAULT_SHADE);
  };
  return picked.map((value) => {
    if (shared !== undefined) return isChartColorName(shared) ? take(shared, SHARED_SHADES) : solidColor(shared, scheme);
    if (value !== undefined && !isChartColorName(value)) return solidColor(value, scheme);
    const name = value ?? nextColor(last);
    const skip = value !== undefined && value === last ? CYCLE_SHADES.length - 2 : 0;
    last = name;
    return take(name, CYCLE_SHADES, skip);
  });
}
