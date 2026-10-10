export type ChartExtent = readonly [number, number] | undefined;

export interface ChartStackable {
  dataKey: string;
  stack?: string;
}

export const CHART_TICK_COUNT = 5;

const MAX_CORRECTION = 64;

function fix(n: number): number {
  return Number(n.toPrecision(12));
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
  step: number;
  lo: number;
  hi: number;
}

function tickSpan(min: number, max: number, correction: number): TickSpan {
  const step = adaptiveStep((max - min) / (CHART_TICK_COUNT - 1), correction);
  const half = (min + max) / 2;
  const middle = min <= 0 && max >= 0 ? 0 : fix(half - (half % step));
  let below = Math.ceil(fix((middle - min) / step));
  let up = Math.ceil(fix((max - middle) / step));
  const count = below + up + 1;
  if (count > CHART_TICK_COUNT && correction < MAX_CORRECTION) return tickSpan(min, max, correction + 1);
  if (count < CHART_TICK_COUNT) {
    if (max > 0) up += CHART_TICK_COUNT - count;
    else below += CHART_TICK_COUNT - count;
  }
  return { step, lo: fix(middle - below * step), hi: fix(middle + up * step) };
}

export function chartTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (!(max > min)) return Array.from({ length: CHART_TICK_COUNT }, (_, i) => fix(min + i));
  const { step, lo, hi } = tickSpan(min, max, 0);
  if (!(step > 0)) return [lo, hi];
  const ticks: number[] = [];
  for (let value = lo; value <= hi + step / 10; value = fix(value + step)) ticks.push(value);
  return ticks;
}

export function chartNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
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
      running[i] = base + value;
      return [base, base + value];
    });
  });
}

export interface ChartValueScale {
  ticks: number[];
  lo: number;
  hi: number;
}

export function chartValueScale(extents: readonly ChartExtent[][]): ChartValueScale {
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
