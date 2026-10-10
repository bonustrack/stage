import {
  CHART_CURVE_TYPES, isChartColorToken, type ChartColor, type ChartDatum, type ChartSeries, type ChartValue, type ChartXAxis,
} from './chart';
import { bool, cssColor, isRecord, label, oneOf, str, type Validator } from './frame.values';

const MAX_ROWS = 200;
const MAX_SERIES = 12;
const MAX_KEYS = 50;
const MAX_KEY = 120;
const MAX_VALUE = 200;
const MAX_AXIS_LABELS = 200;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SERIES_TYPE = oneOf(['bar', 'line', 'area']);
const CURVE_TYPE = oneOf(CHART_CURVE_TYPES);
const stackId = str(MAX_KEY);

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function dataKey(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw !== '' && raw.length <= MAX_KEY && !UNSAFE_KEYS.has(raw) ? raw : undefined;
}

function cellValue(raw: unknown): ChartValue | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  return typeof raw === 'string' ? raw.slice(0, MAX_VALUE) : undefined;
}

function row(raw: Record<string, unknown>): ChartDatum {
  return Object.fromEntries(Object.entries(raw).slice(0, MAX_KEYS).flatMap(([key, value]) => {
    const cell = cellValue(value);
    return dataKey(key) === undefined || cell === undefined ? [] : [[key, cell]];
  }));
}

export const chartData: Validator<ChartDatum[]> = (raw) => (
  Array.isArray(raw) ? raw.slice(0, MAX_ROWS).filter(isRecord).map(row) : undefined
);

function colorValue(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return isChartColorToken(value) || cssColor(value) !== undefined ? value : undefined;
}

const chartColor: Validator<ChartColor> = (raw) => {
  if (!isRecord(raw)) return colorValue(raw);
  const light = colorValue(raw.light);
  const dark = colorValue(raw.dark);
  return light !== undefined && dark !== undefined ? { light, dark } : undefined;
};

function seriesOf(raw: unknown): ChartSeries | undefined {
  if (!isRecord(raw)) return undefined;
  const type = SERIES_TYPE(raw.type);
  const key = dataKey(raw.dataKey);
  if (type === undefined || key === undefined) return undefined;
  const base = { dataKey: key, label: label(raw.label), color: chartColor(raw.color) };
  if (type === 'line') return compact({ type, ...base, curveType: CURVE_TYPE(raw.curveType) });
  if (type === 'area') return compact({ type, ...base, stack: stackId(raw.stack), curveType: CURVE_TYPE(raw.curveType) });
  return compact({ type, ...base, stack: stackId(raw.stack) });
}

export const chartSeries: Validator<ChartSeries[]> = (raw) => {
  if (!Array.isArray(raw)) return undefined;
  const series = raw.flatMap((s) => seriesOf(s) ?? []).slice(0, MAX_SERIES);
  return series.length > 0 ? series : undefined;
};

function axisLabels(raw: unknown): Record<string, string> | undefined {
  if (!isRecord(raw)) return undefined;
  return Object.fromEntries(Object.entries(raw).slice(0, MAX_AXIS_LABELS).flatMap(([key, value]) => (
    typeof value === 'string' && !UNSAFE_KEYS.has(key) ? [[key, value.slice(0, MAX_VALUE)]] : []
  )));
}

export const chartXAxis: Validator<ChartXAxis> = (raw) => {
  const key = dataKey(raw);
  if (key !== undefined || !isRecord(raw)) return key;
  const axisKey = dataKey(raw.dataKey);
  return axisKey === undefined ? undefined : compact({ dataKey: axisKey, hide: bool(raw.hide), labels: axisLabels(raw.labels) });
};
