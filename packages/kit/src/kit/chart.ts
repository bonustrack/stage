import type { ChartNode } from './nodes';
import type { ChartSeries, XAxisConfig } from './node-fields';
import { resolveColor, type Scheme } from './resolve';
import { resolveColorToken } from '../tokens';

export const CHART_DEFAULT_HEIGHT = 220;
export const CHART_PAD_TOP = 12;
export const CHART_PAD_BOTTOM = 28;
export const CHART_PAD_RIGHT = 12;
export const CHART_AXIS_W_WITH_Y = 40;
export const CHART_AXIS_W_NO_Y = 12;

const CHART_PALETTE = [
  '#4f8ff7',
  '#57b375',
  '#c0a06e',
  '#d96868',
  '#9b7fe0',
  '#3fb6c0',
];

export function chartSeriesColor(
  series: ChartSeries,
  index: number,
  scheme: Scheme,
): string {
  if (series.color !== undefined) return resolveColor(series.color, scheme);
  return CHART_PALETTE[index % CHART_PALETTE.length] ?? CHART_PALETTE[0] ?? '#4f8ff7';
}

export function chartXAxis(node: ChartNode): XAxisConfig {
  if (typeof node.xAxis === 'string') return { dataKey: node.xAxis };
  return node.xAxis;
}

export function chartXLabel(config: XAxisConfig, row: Record<string, unknown>): string {
  const raw = row[config.dataKey];
  const key =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw)
        : '';
  return config.labels?.[key] ?? key;
}

function rowValue(row: Record<string, unknown>, key: string): number {
  const raw = row[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function stackKey(series: ChartSeries): string | undefined {
  if (series.type === 'line') return undefined;
  return series.stack;
}

function maxStackedValue(
  data: Record<string, unknown>[],
  series: ChartSeries[],
): number {
  let max = 0;
  for (const row of data) {
    const groups = new Map<string, number>();
    let loose = 0;
    for (const s of series) {
      const v = rowValue(row, s.dataKey);
      const sk = stackKey(s);
      if (sk !== undefined) groups.set(sk, (groups.get(sk) ?? 0) + v);
      else loose = Math.max(loose, v);
    }
    let rowMax = loose;
    for (const total of groups.values()) rowMax = Math.max(rowMax, total);
    max = Math.max(max, rowMax);
  }
  return max <= 0 ? 1 : max;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  maxValue: number;
  rowCount: number;
  bandWidth: number;
  showYAxis: boolean;
  yTicks: { value: number; y: number }[];
}

export function chartGeometry(
  node: ChartNode,
  width: number,
): ChartGeometry {
  const height =
    typeof node.height === 'number'
      ? node.height
      : CHART_DEFAULT_HEIGHT;
  const showYAxis = node.showYAxis === true;
  const plotLeft = showYAxis ? CHART_AXIS_W_WITH_Y : CHART_AXIS_W_NO_Y;
  const plotTop = CHART_PAD_TOP;
  const plotWidth = Math.max(1, width - plotLeft - CHART_PAD_RIGHT);
  const plotHeight = Math.max(1, height - plotTop - CHART_PAD_BOTTOM);
  const maxValue = maxStackedValue(node.data, node.series);
  const rowCount = Math.max(1, node.data.length);
  const bandWidth = plotWidth / rowCount;
  const tickCount = 4;
  const yTicks: { value: number; y: number }[] = [];
  if (showYAxis) {
    for (let i = 0; i <= tickCount; i++) {
      const value = (maxValue / tickCount) * i;
      const y = plotTop + plotHeight - (value / maxValue) * plotHeight;
      yTicks.push({ value, y });
    }
  }
  return {
    width,
    height,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    maxValue,
    rowCount,
    bandWidth,
    showYAxis,
    yTicks,
  };
}

function valueToY(g: ChartGeometry, value: number): number {
  return g.plotTop + g.plotHeight - (value / g.maxValue) * g.plotHeight;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

function barSeries(series: ChartSeries[]): ChartSeries[] {
  return series.filter((s) => s.type === 'bar');
}

function stackGroupsFor(series: ChartSeries[]): { key: string; members: ChartSeries[] }[] {
  const order: string[] = [];
  const map = new Map<string, ChartSeries[]>();
  series.forEach((s, i) => {
    const sk = stackKey(s) ?? `__loose_${i}`;
    if (!map.has(sk)) {
      map.set(sk, []);
      order.push(sk);
    }
    map.get(sk)?.push(s);
  });
  return order.map((key) => ({ key, members: map.get(key) ?? [] }));
}

export function chartBars(
  node: ChartNode,
  g: ChartGeometry,
  scheme: Scheme,
): BarRect[] {
  const bars = barSeries(node.series);
  if (bars.length === 0) return [];
  const colorIndex = new Map<ChartSeries, number>();
  node.series.forEach((s, i) => colorIndex.set(s, i));
  const groups = stackGroupsFor(bars);
  const categoryGap = clamp01(node.barCategoryGap, 0.2);
  const barGap = clamp01(node.barGap, 0.1);
  const innerWidth = g.bandWidth * (1 - categoryGap);
  const groupCount = groups.length;
  const slot = innerWidth / groupCount;
  const barWidth = slot * (1 - barGap);
  const rects: BarRect[] = [];
  node.data.forEach((row, ri) => {
    const bandStart = g.plotLeft + ri * g.bandWidth + (g.bandWidth - innerWidth) / 2;
    groups.forEach((group, gi) => {
      const slotStart = bandStart + gi * slot + (slot - barWidth) / 2;
      let acc = 0;
      group.members.forEach((s) => {
        const v = rowValue(row, s.dataKey);
        const yTop = valueToY(g, acc + v);
        const yBase = valueToY(g, acc);
        rects.push({
          x: slotStart,
          y: yTop,
          width: barWidth,
          height: Math.max(0, yBase - yTop),
          color: chartSeriesColor(s, colorIndex.get(s) ?? 0, scheme),
        });
        acc += v;
      });
    });
  });
  return rects;
}

function clamp01(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 0.9) return 0.9;
  return value;
}

export interface LinePath {
  points: { x: number; y: number }[];
  color: string;
  fill: boolean;
  baseY: number;
}

function pointSeries(
  node: ChartNode,
  type: 'line' | 'area',
): { s: ChartSeries; idx: number }[] {
  const result: { s: ChartSeries; idx: number }[] = [];
  node.series.forEach((s, i) => {
    if (s.type === type) result.push({ s, idx: i });
  });
  return result;
}

export function chartLines(
  node: ChartNode,
  g: ChartGeometry,
  scheme: Scheme,
  type: 'line' | 'area',
): LinePath[] {
  const baseY = valueToY(g, 0);
  return pointSeries(node, type).map(({ s, idx }) => {
    const points = node.data.map((row, ri) => {
      const x = g.plotLeft + ri * g.bandWidth + g.bandWidth / 2;
      const y = valueToY(g, rowValue(row, s.dataKey));
      return { x, y };
    });
    return {
      points,
      color: chartSeriesColor(s, idx, scheme),
      fill: type === 'area',
      baseY,
    };
  });
}

export function linePathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ');
}

export function areaPathD(
  points: { x: number; y: number }[],
  baseY: number,
): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return '';
  return `${linePathD(points)} L${round(last.x)} ${round(baseY)} L${round(first.x)} ${round(baseY)} Z`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LegendItem {
  label: string;
  color: string;
}

export function chartLegend(node: ChartNode, scheme: Scheme): LegendItem[] {
  return node.series.map((s, i) => ({
    label: s.label ?? s.dataKey,
    color: chartSeriesColor(s, i, scheme),
  }));
}

export function chartXTickLabels(node: ChartNode): { x: number; label: string }[] | undefined {
  const config = chartXAxis(node);
  if (config.hide === true) return undefined;
  return node.data.map((row, ri) => ({
    x: ri,
    label: chartXLabel(config, row),
  }));
}

export function chartAxisColor(scheme: Scheme): string {
  return resolveColorToken('border', scheme);
}

export function chartTextColor(scheme: Scheme): string {
  return resolveColorToken('secondary', scheme);
}

export function formatTick(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
