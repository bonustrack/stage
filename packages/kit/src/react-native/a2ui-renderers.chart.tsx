import type { ReactNode } from 'react';
import { CHART_CURVE_TYPES, CHART_LIMITS, isChartColorToken, type ChartDatum, type ChartSeries, type ChartXAxis, type ChartYAxisConfig } from '../chart';
import { Chart } from './chart';
import { asBoolean, asEnum, asNumber, asOptionalString, colorValueOf, lengthOf, type RenderContext } from './a2ui-context';

const DOMAIN_BOUNDS = ['auto', 'dataMin', 'dataMax'] as const;

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}

function datumOf(value: unknown): ChartDatum | undefined {
  const row = recordOf(value);
  if (row === undefined) return undefined;
  return Object.fromEntries(Object.entries(row).filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || (typeof entry[1] === 'number' && Number.isFinite(entry[1]))));
}

function seriesColorOf(value: unknown): string | undefined {
  return typeof value === 'string' && (isChartColorToken(value) || colorValueOf(value) !== undefined) ? value : undefined;
}

function seriesOf(value: unknown): ChartSeries | undefined {
  const raw = recordOf(value);
  const type = asEnum(raw?.type, ['bar', 'line', 'area']);
  const dataKey = asOptionalString(raw?.dataKey);
  if (raw === undefined || type === undefined || dataKey === undefined) return undefined;
  const base = { dataKey, label: asOptionalString(raw.label), color: seriesColorOf(raw.color) };
  const curveType = asEnum(raw.curveType, CHART_CURVE_TYPES);
  const stack = asOptionalString(raw.stack);
  if (type === 'bar') return { ...base, type, stack };
  return type === 'area' ? { ...base, type, stack, curveType } : { ...base, type, curveType };
}

function xAxisOf(value: unknown): ChartXAxis | undefined {
  if (typeof value === 'string') return value;
  const raw = recordOf(value);
  const dataKey = asOptionalString(raw?.dataKey);
  if (raw === undefined || dataKey === undefined) return undefined;
  const labels = recordOf(raw.labels);
  return {
    dataKey,
    hide: asBoolean(raw.hide),
    labels: labels === undefined ? undefined : Object.fromEntries(Object.entries(labels).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  };
}

function yAxisOf(value: unknown): ChartYAxisConfig | undefined {
  const domain = recordOf(value)?.domain;
  if (!Array.isArray(domain) || domain.length !== 2) return undefined;
  const bounds = domain.map((bound) => asNumber(bound) ?? asEnum(bound, DOMAIN_BOUNDS));
  const [low, high] = bounds;
  return low === undefined || high === undefined ? undefined : { domain: [low, high] };
}

export function chartRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const rows = Array.isArray(p.data) ? p.data.slice(0, CHART_LIMITS.rows) : [];
  const data = rows.map(datumOf).filter((row): row is ChartDatum => row !== undefined);
  const series = (Array.isArray(p.series) ? p.series.slice(0, CHART_LIMITS.series) : []).map(seriesOf).filter((item): item is ChartSeries => item !== undefined);
  const xAxis = xAxisOf(p.xAxis);
  if (series.length === 0 || xAxis === undefined) return null;
  return (
    <Chart
      data={data}
      series={series}
      xAxis={xAxis}
      yAxis={yAxisOf(p.yAxis)}
      showYAxis={asBoolean(p.showYAxis)}
      showLegend={asBoolean(p.showLegend)}
      showTooltip={asBoolean(p.showTooltip)}
      barGap={asNumber(p.barGap)}
      barCategoryGap={asNumber(p.barCategoryGap)}
      width={lengthOf(p.width)}
      height={lengthOf(p.height)}
      aspectRatio={asNumber(p.aspectRatio)}
      flex={ctx.weight}
      dark={ctx.dark}
    />
  );
}
