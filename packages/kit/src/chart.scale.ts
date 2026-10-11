export type ChartDomainBound = number | 'auto' | 'dataMin' | 'dataMax';

export type ChartDomain = readonly [ChartDomainBound, ChartDomainBound];

export interface ChartYAxisConfig {
  domain?: ChartDomain;
}

export type ChartExtent = readonly [number, number] | undefined;

export interface ChartStackable {
  dataKey: string;
  stack?: string;
}

const CHART_TICK_COUNT = 5;

const CHART_MAX_VALUE = 1e300;

const MAX_CORRECTION = 64;
const MAX_TICKS = CHART_TICK_COUNT * 2;

function fix(n: number, precision = 12): number {
  return Number(n.toPrecision(precision));
}

function digitCount(value: number): number {
  if (value === 0) return 1;
  const abs = Math.abs(value);
  let digits = Math.floor(Math.log10(abs));
  if (10 ** (digits + 1) <= abs) digits += 1;
  else if (10 ** digits > abs) digits -= 1;
  return digits + 1;
}

function adaptiveStep(rough: number, correction: number): number {
  if (!(rough > 0)) return 0;
  const digits = digitCount(rough);
  const unit = 10 ** digits;
  const scale = digits === 1 ? 0.1 : 0.05;
  return fix(fix((Math.ceil(fix(rough / unit / scale)) + correction) * scale) * unit);
}

interface TickSpan {
  precision: number;
  step: number;
  lo: number;
  hi: number;
}

function tickSpan(min: number, max: number, correction: number): TickSpan {
  const step = adaptiveStep((max - min) / (CHART_TICK_COUNT - 1), correction);
  const precision = Math.min(17, Math.max(12, digitCount(Math.max(Math.abs(min), Math.abs(max))) - digitCount(step) + 2));
  const half = (min + max) / 2;
  const middle = min <= 0 && max >= 0 ? 0 : fix(half - (half % step), precision);
  let below = Math.ceil(fix((middle - min) / step));
  let up = Math.ceil(fix((max - middle) / step));
  const count = below + up + 1;
  if (count > CHART_TICK_COUNT && correction < MAX_CORRECTION) return tickSpan(min, max, correction + 1);
  if (count < CHART_TICK_COUNT) {
    if (max > 0) up += CHART_TICK_COUNT - count;
    else below += CHART_TICK_COUNT - count;
  }
  return { step, precision, lo: fix(middle - below * step, precision), hi: fix(middle + up * step, precision) };
}

export function chartTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (!(max > min)) return Array.from({ length: CHART_TICK_COUNT }, (_, i) => fix(min + i));
  const { step, precision, lo, hi } = tickSpan(min, max, 0);
  if (!(step > 0) || !Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [min, max];
  return ticksInSpan({ step, precision, lo, hi });
}

function ticksInSpan({ step, precision, lo, hi }: TickSpan): number[] {
  const ticks: number[] = [];
  for (let i = 0; i < MAX_TICKS; i += 1) {
    const value = fix(lo + i * step, precision);
    const previous = ticks[ticks.length - 1];
    if (value > hi + step / 10 || (previous !== undefined && value <= previous)) break;
    ticks.push(value);
  }
  return ticks;
}

function bounded(n: number): number | undefined {
  return Number.isFinite(n) && Math.abs(n) <= CHART_MAX_VALUE ? n : undefined;
}

export function chartNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return bounded(raw);
  return typeof raw === 'string' && raw.trim() !== '' ? bounded(Number(raw)) : undefined;
}

export function chartExtents(
  data: readonly Readonly<Record<string, unknown>>[],
  series: readonly ChartStackable[],
): ChartExtent[][] {
  const sums = new Map<string, number[]>();
  return series.map((s) => {
    const running = s.stack === undefined ? undefined : sums.get(s.stack) ?? [];
    if (s.stack !== undefined && running !== undefined) sums.set(s.stack, running);
    return data.map((row, i): ChartExtent => {
      const value = chartNumber(row[s.dataKey]);
      if (value === undefined) return undefined;
      if (running === undefined) return [0, value];
      const base = running[i] ?? 0;
      const top = bounded(base + value);
      if (top === undefined) return undefined;
      running[i] = top;
      return [base, top];
    });
  });
}

export interface ChartValueScale {
  ticks: number[];
  lo: number;
  hi: number;
}

function defaultScale(extents: readonly ChartExtent[][]): ChartValueScale {
  let min = 0;
  let max = 0;
  for (const extent of extents.flat()) {
    if (extent === undefined) continue;
    min = Math.min(min, extent[0], extent[1]);
    max = Math.max(max, extent[0], extent[1]);
  }
  const ticks = chartTicks(min, max);
  return { ticks, lo: Math.min(min, ticks[0] ?? min), hi: Math.max(max, ticks[ticks.length - 1] ?? max) };
}

function domainBound(raw: unknown): ChartDomainBound | undefined {
  if (raw === 'auto' || raw === 'dataMin' || raw === 'dataMax') return raw;
  return typeof raw === 'number' ? bounded(raw) : undefined;
}

export function chartDomain(raw: unknown): ChartDomain | undefined {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const lo = domainBound(raw[0]);
  const hi = domainBound(raw[1]);
  if (lo === undefined || hi === undefined) return undefined;
  if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) return undefined;
  return [lo, hi];
}

function dataRange(extents: readonly ChartExtent[][], series: readonly ChartStackable[]): readonly [number, number] {
  let min = Infinity;
  let max = -Infinity;
  extents.forEach((values, i) => {
    for (const e of values) {
      if (e === undefined) continue;
      const base = series[i]?.stack === undefined ? e[1] : e[0];
      min = Math.min(min, base, e[1]);
      max = Math.max(max, base, e[1]);
    }
  });
  return min <= max ? [min, max] : [0, 0];
}

function resolveBound(bound: ChartDomainBound, min: number, max: number, fallback: number): number {
  if (typeof bound === 'number') return bound;
  if (bound === 'dataMin') return min;
  return bound === 'dataMax' ? max : fallback;
}

function domainScale(min: number, max: number, domain: ChartDomain): ChartValueScale {
  let lo = Math.min(min, resolveBound(domain[0], min, max, min));
  let hi = Math.max(max, resolveBound(domain[1], min, max, max));
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const nice = chartTicks(lo, hi);
  if (domain.includes('auto')) {
    lo = Math.min(lo, nice[0] ?? lo);
    hi = Math.max(hi, nice[nice.length - 1] ?? hi);
  }
  const ticks = [...new Set(nice.filter((t) => t >= lo && t <= hi))];
  return { lo, hi, ticks: ticks.length >= 2 ? ticks : [lo, hi] };
}

export function chartValueScale(
  extents: readonly ChartExtent[][],
  series: readonly ChartStackable[],
  requested?: ChartDomain,
): ChartValueScale {
  const domain = chartDomain(requested);
  if (domain === undefined || (domain[0] === 0 && domain[1] === 'auto')) return defaultScale(extents);
  const [min, max] = dataRange(extents, series);
  return domainScale(min, max, domain);
}
