import { chartCategoryColor, type ChartColor } from './chart.colors';
import { chartAreaPath, chartCurvePath, type ChartCurveType, type ChartPoint } from './chart.curves';
import { chartExtents, chartNumber, chartValueScale, type ChartExtent } from './chart.scale';
import { FONT_SIZE } from './tokens';

export {
  CHART_COLORS, chartPrimitiveColor, chartSeriesColors, isChartColorName, isChartColorToken,
  type ChartColor, type ChartColorName,
} from './chart.colors';
export { CHART_CURVE_TYPES, type ChartCurveType, type ChartPoint } from './chart.curves';
export { chartNumber, chartTicks } from './chart.scale';

export type ChartValue = string | number;

export type ChartDatum = Readonly<Record<string, ChartValue>>;

interface ChartSeriesBase {
  dataKey: string;
  label?: string;
  color?: ChartColor;
}

export interface ChartBarSeries extends ChartSeriesBase {
  type: 'bar';
  stack?: string;
}

export interface ChartAreaSeries extends ChartSeriesBase {
  type: 'area';
  stack?: string;
  curveType?: ChartCurveType;
}

export interface ChartLineSeries extends ChartSeriesBase {
  type: 'line';
  curveType?: ChartCurveType;
}

export type ChartSeries = ChartBarSeries | ChartAreaSeries | ChartLineSeries;

export interface ChartXAxisConfig {
  dataKey: string;
  hide?: boolean;
  labels?: Readonly<Record<string, string>>;
}

export type ChartXAxis = string | ChartXAxisConfig;

export const CHART_DEFAULTS = {
  showYAxis: false,
  showLegend: true,
  showTooltip: true,
  curveType: 'natural',
  aspectRatio: 4 / 3,
  barGap: 3,
} as const;

export const CHART_LABEL_SIZE = FONT_SIZE['3xs'];

export const CHART_TICK_SIZE = 6;

export const CHART_MARGIN = 5;

const X_AXIS_HEIGHT = 30;
const X_AXIS_HIDDEN_HEIGHT = 7;
const X_LABEL_OFFSET = CHART_TICK_SIZE + 5;
const Y_LABEL_MARGIN = 2;
const MIN_TICK_GAP = 10;
const CHAR_EM = 0.6;
const BAR_STROKE = 1;
const BAR_CATEGORY_GAP = 0.1;
const BAR_END_RADIUS = 4;
const BAR_BASE_RADIUS = 1;

export interface ChartPlot {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ChartCategory {
  label: string;
  x: number;
  start: number;
  end: number;
}

export interface ChartAxisLabel {
  index: number;
  text: string;
  x: number;
}

export interface ChartTick {
  value: number;
  y: number;
  label: string;
}

export interface ChartBar {
  series: number;
  index: number;
  path: string;
}

export interface ChartShape {
  series: number;
  line: string;
  area?: string;
  points: readonly (ChartPoint | undefined)[];
}

export interface ChartGeometry {
  plot: ChartPlot;
  categories: ChartCategory[];
  labels: ChartAxisLabel[];
  labelY: number;
  ticks: ChartTick[];
  bars: ChartBar[];
  shapes: ChartShape[];
}

export interface ChartGeometryInput {
  data: readonly ChartDatum[];
  series: readonly ChartSeries[];
  xAxis: ChartXAxis;
  width: number;
  height: number;
  showYAxis?: boolean;
  legend?: boolean;
  barGap?: number;
  barCategoryGap?: number;
}

export function chartXKey(xAxis: ChartXAxis): string {
  return typeof xAxis === 'string' ? xAxis : xAxis.dataKey;
}

export function chartXHidden(xAxis: ChartXAxis): boolean {
  return typeof xAxis !== 'string' && xAxis.hide === true;
}

export function chartXLabel(xAxis: ChartXAxis, row: ChartDatum | undefined): string {
  const raw = row?.[chartXKey(xAxis)];
  const key = raw === undefined ? '' : String(raw);
  const labels = typeof xAxis === 'string' ? undefined : xAxis.labels;
  return labels !== undefined && Object.hasOwn(labels, key) ? labels[key] ?? key : key;
}

export function chartAspectRatio(value: number | string | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : CHART_DEFAULTS.aspectRatio;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*$/.exec(value ?? '');
  const ratio = Number(match?.[1]) / Number(match?.[2] ?? 1);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : CHART_DEFAULTS.aspectRatio;
}

export function chartTextWidth(text: string): number {
  return text.length * CHART_LABEL_SIZE * CHAR_EM;
}

export function chartBarColor(series: readonly ChartSeries[], colors: readonly string[], seriesIndex: number, index: number): string {
  const only = series.length === 1 ? series[0] : undefined;
  if (only?.type === 'bar' && only.color === undefined) return chartCategoryColor(index);
  return colors[seriesIndex] ?? chartCategoryColor(seriesIndex);
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function yAxisWidth(ticks: readonly number[]): number {
  const widest = Math.max(0, ...ticks.map((t) => chartTextWidth(String(t))));
  return Math.ceil(widest) + CHART_TICK_SIZE + Y_LABEL_MARGIN * 2;
}

function plotOf(input: ChartGeometryInput, ticks: readonly number[]): ChartPlot {
  const axis = chartXHidden(input.xAxis) ? X_AXIS_HIDDEN_HEIGHT : X_AXIS_HEIGHT;
  return {
    left: CHART_MARGIN + (input.showYAxis === true ? yAxisWidth(ticks) : 0),
    top: CHART_MARGIN,
    right: Math.max(CHART_MARGIN, input.width - CHART_MARGIN),
    bottom: Math.max(CHART_MARGIN + 1, input.height - axis - (input.legend === true ? 0 : CHART_MARGIN)),
  };
}

function categoriesOf(input: ChartGeometryInput, plot: ChartPlot, banded: boolean): ChartCategory[] {
  const n = input.data.length;
  const width = plot.right - plot.left;
  const step = banded ? width / Math.max(1, n) : width / Math.max(1, n - 1);
  return input.data.map((row, i) => {
    const x = banded ? plot.left + (i + 0.5) * step : n > 1 ? plot.left + i * step : plot.left + width / 2;
    return {
      label: chartXLabel(input.xAxis, row),
      x,
      start: Math.max(plot.left, x - step / 2),
      end: Math.min(plot.right, x + step / 2),
    };
  });
}

function labelsOf(categories: readonly ChartCategory[], plot: ChartPlot): ChartAxisLabel[] {
  const shown: ChartAxisLabel[] = [];
  let end = plot.right;
  for (let i = categories.length - 1; i >= 0; i -= 1) {
    const cat = categories[i];
    if (cat === undefined || cat.label === '') continue;
    const half = chartTextWidth(cat.label) / 2;
    const x = Math.max(Math.min(cat.x, plot.right - half), i === 0 ? plot.left + half : -Infinity);
    if (x - half < plot.left - 0.5 || x + half > end + 0.5) continue;
    shown.push({ index: i, text: cat.label, x });
    end = x - half - MIN_TICK_GAP;
  }
  return shown.reverse();
}

type Radius = readonly [number, number, number, number];

function rectPath(x: number, y: number, w: number, h: number, radius: Radius): string {
  const max = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
  const ys = h >= 0 ? 1 : -1;
  const cw = h >= 0 ? 1 : 0;
  const [tl, tr, br, bl] = radius.map((r) => Math.min(r, max));
  if (tl === undefined || tr === undefined || br === undefined || bl === undefined || max <= 0) {
    return `M${num(x)},${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`;
  }
  const arc = (r: number, px: number, py: number): string => (r > 0 ? `A${num(r)},${num(r)},0,0,${cw},${num(px)},${num(py)}` : '');
  return [
    `M${num(x)},${num(y + ys * tl)}`, arc(tl, x + tl, y),
    `L${num(x + w - tr)},${num(y)}`, arc(tr, x + w, y + ys * tr),
    `L${num(x + w)},${num(y + h - ys * br)}`, arc(br, x + w - br, y + h),
    `L${num(x + bl)},${num(y + h)}`, arc(bl, x, y + h - ys * bl), 'Z',
  ].join('');
}

interface BarLayout {
  slots: Map<string, number>;
  offset: number;
  gap: number;
  size: number;
}

function barKey(series: ChartSeries, index: number): string {
  return series.type === 'bar' && series.stack !== undefined ? `stack:${series.stack}` : `series:${index}`;
}

function barLayout(input: ChartGeometryInput, band: number): BarLayout {
  const slots = new Map<string, number>();
  input.series.forEach((s, i) => {
    if (s.type === 'bar' && !slots.has(barKey(s, i))) slots.set(barKey(s, i), slots.size);
  });
  const count = Math.max(1, slots.size);
  const offset = input.barCategoryGap ?? band * BAR_CATEGORY_GAP;
  const wanted = (input.barGap ?? CHART_DEFAULTS.barGap) + BAR_STROKE;
  const gap = band - 2 * offset - (count - 1) * wanted <= 0 ? 0 : wanted;
  const raw = (band - 2 * offset - (count - 1) * gap) / count;
  return { slots, offset, gap, size: raw > 1 ? Math.trunc(raw) : raw };
}

function barRadius(series: readonly ChartSeries[], index: number): Radius {
  const s = series[index];
  if (s?.type !== 'bar' || s.stack === undefined) return [BAR_END_RADIUS, BAR_END_RADIUS, BAR_BASE_RADIUS, BAR_BASE_RADIUS];
  const peers = series.flatMap((p, i) => (p.type === 'bar' && p.stack === s.stack ? [i] : []));
  const end = peers[peers.length - 1] === index ? BAR_END_RADIUS : 0;
  const base = peers[0] === index ? BAR_BASE_RADIUS : 0;
  return [end, end, base, base];
}

interface Scale {
  y: (value: number) => number;
  band: number;
}

function barsOf(input: ChartGeometryInput, extents: readonly ChartExtent[][], categories: readonly ChartCategory[], scale: Scale): ChartBar[] {
  const layout = barLayout(input, scale.band);
  if (!(layout.size > 0)) return [];
  return input.series.flatMap((s, si) => {
    const slot = layout.slots.get(barKey(s, si));
    if (s.type !== 'bar' || slot === undefined) return [];
    const radius = barRadius(input.series, si);
    return (extents[si] ?? []).flatMap((extent, i) => {
      const cat = categories[i];
      if (extent === undefined || cat === undefined || extent[0] === extent[1]) return [];
      const x = cat.x - scale.band / 2 + layout.offset + (layout.size + layout.gap) * slot;
      const y = scale.y(extent[1]);
      return [{ series: si, index: i, path: rectPath(x, y, layout.size, scale.y(extent[0]) - y, radius) }];
    });
  });
}

type Pair = readonly [ChartPoint, ChartPoint];

function segments(pairs: readonly (Pair | undefined)[]): Pair[][] {
  const out: Pair[][] = [[]];
  for (const pair of pairs) {
    if (pair !== undefined) out[out.length - 1]?.push(pair);
    else if ((out[out.length - 1]?.length ?? 0) > 0) out.push([]);
  }
  return out.filter((part) => part.length > 0);
}

function shapeOf(s: ChartSeries, si: number, extents: readonly ChartExtent[], categories: readonly ChartCategory[], y: (v: number) => number): ChartShape {
  const curve = s.type === 'bar' ? 'linear' : s.curveType ?? CHART_DEFAULTS.curveType;
  const pairs = extents.map((e, i): Pair | undefined => {
    const cat = categories[i];
    return e === undefined || cat === undefined ? undefined : [[cat.x, y(e[1])], [cat.x, y(e[0])]];
  });
  const parts = segments(pairs);
  const line = parts.map((part) => chartCurvePath(part.map((p) => p[0]), curve, 'line')).join('');
  const area = s.type === 'area' ? parts.map((part) => chartAreaPath(part.map((p) => p[0]), part.map((p) => p[1]), curve)).join('') : undefined;
  return { series: si, line, area, points: pairs.map((p) => p?.[0]) };
}

export function chartGeometry(input: ChartGeometryInput): ChartGeometry {
  const extents = chartExtents(input.data, input.series.map((s) => ({ dataKey: s.dataKey, stack: s.type === 'line' ? undefined : s.stack })));
  const { ticks, lo, hi } = chartValueScale(extents);
  const plot = plotOf(input, ticks);
  const y = (v: number): number => plot.bottom - ((v - lo) / (hi - lo || 1)) * (plot.bottom - plot.top);
  const banded = input.series.some((s) => s.type === 'bar');
  const categories = categoriesOf(input, plot, banded);
  const scale: Scale = { y, band: (plot.right - plot.left) / Math.max(1, input.data.length) };
  return {
    plot,
    categories,
    labels: chartXHidden(input.xAxis) ? [] : labelsOf(categories, plot),
    labelY: plot.bottom + X_LABEL_OFFSET + CHART_LABEL_SIZE * 0.8,
    ticks: ticks.map((value) => ({ value, y: y(value), label: String(value) })),
    bars: barsOf(input, extents, categories, scale),
    shapes: input.series.flatMap((s, si) => (s.type === 'bar' ? [] : [shapeOf(s, si, extents[si] ?? [], categories, y)])),
  };
}

export interface ChartTooltipRow {
  series: number;
  name?: string;
  value: string;
}

function displayValue(raw: ChartValue | undefined): string | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw.toLocaleString() : undefined;
  return raw === undefined || raw === '' ? undefined : raw;
}

export function chartTooltipRows(series: readonly ChartSeries[], row: ChartDatum | undefined): ChartTooltipRow[] {
  const named = series.some((s) => s.label !== undefined && s.label !== '');
  return series.flatMap((s, i) => {
    const value = displayValue(row?.[s.dataKey]);
    if (value === undefined || chartNumber(row?.[s.dataKey]) === undefined) return [];
    const name = s.label !== undefined && s.label !== '' ? s.label : named ? s.dataKey : undefined;
    return [name === undefined ? { series: i, value } : { series: i, name, value }];
  });
}
