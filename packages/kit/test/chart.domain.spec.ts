import { describe, expect, test } from 'bun:test';
import { chartGeometry, chartTooltipRows, type ChartDomain, type ChartGeometryInput, type ChartSeries } from '../src/chart';
import { chartDomain, chartExtents, chartValueScale } from '../src/chart.scale';

const DOMAIN: ChartDomain = ['dataMin', 'dataMax'];
const SERIES: ChartSeries[] = [{ type: 'line', dataKey: 'v', label: 'USD', curveType: 'linear' }];
const INPUT: ChartGeometryInput = {
  data: [
    { x: 'a', v: 2490 },
    { x: 'b', v: 2505 },
    { x: 'c', v: 2499 },
  ],
  series: SERIES,
  xAxis: 'x',
  width: 320,
  height: 114,
  showYAxis: true,
};

function scale(values: number[], domain: ChartDomain = DOMAIN): ReturnType<typeof chartValueScale> {
  return chartValueScale(
    chartExtents(
      values.map((v) => ({ v })),
      SERIES,
    ),
    SERIES,
    domain,
  );
}

describe('Chart yAxis.domain', () => {
  test('keeps only the official finite domain tuple', () => {
    for (const domain of [DOMAIN, [0, 'auto'], ['auto', 'dataMax'], [-100, 100], [1, 1], ['dataMin', 0]]) {
      expect(chartDomain(domain)).toEqual(domain);
    }
    for (const domain of [
      [],
      [0],
      [0, 1, 2],
      [null, 1],
      ['0', 1],
      ['dataMin - 10', 'dataMax'],
      [NaN, 1],
      [0, Infinity],
      [0, 1e308],
      [2, 1],
      null,
      'auto',
      {},
    ]) {
      expect(chartDomain(domain)).toBeUndefined();
    }
  });

  test('data bounds use actual prices, not a synthetic zero baseline', () => {
    const g = chartGeometry({ ...INPUT, yAxis: { domain: DOMAIN } });
    expect(g.shapes[0]?.points[0]?.[1]).toBe(g.plot.bottom);
    expect(g.shapes[0]?.points[1]?.[1]).toBe(g.plot.top);
    expect(g.ticks.every((t) => t.value >= 2490 && t.value <= 2505)).toBe(true);
    expect(chartTooltipRows(SERIES, INPUT.data[1])).toEqual([{ series: 0, name: 'USD', value: (2505).toLocaleString() }]);
    expect(INPUT.data[0]?.v).toBe(2490);
  });

  test('omitted, invalid and hidden-axis domains preserve default zero-based geometry', () => {
    for (const type of ['line', 'area', 'bar'] as const) {
      const input = { ...INPUT, series: [{ type, dataKey: 'v' }] };
      const original = chartGeometry(input);
      expect(chartGeometry({ ...input, yAxis: {} })).toEqual(original);
      expect(chartGeometry({ ...input, yAxis: { domain: [0, 'auto'] } })).toEqual(original);
      expect(chartGeometry({ ...input, yAxis: { domain: [Infinity, NaN] } })).toEqual(original);
      expect(chartGeometry({ ...input, showYAxis: false, yAxis: { domain: DOMAIN } })).toEqual(
        chartGeometry({ ...input, showYAxis: false }),
      );
      expect(original.ticks[0]?.value).toBe(0);
    }
  });

  test('numeric bounds expand to contain data and auto bounds use nice ticks', () => {
    expect(scale([10, 20], [5, 30])).toMatchObject({ lo: 5, hi: 30 });
    expect(scale([10, 20], [12, 18])).toMatchObject({ lo: 10, hi: 20 });
    expect(scale([10, 20], [10, 10])).toMatchObject({ lo: 10, hi: 20 });
    expect(scale([10, 20], [5, 'auto'])).toEqual({ lo: 4, hi: 20, ticks: [4, 8, 12, 16, 20] });
    expect(scale([-20, -10])).toMatchObject({ lo: -20, hi: -10 });
    expect(scale([-20, 10])).toMatchObject({ lo: -20, hi: 10 });
    const auto = scale([2491.23, 2504.56], ['auto', 'auto']);
    expect(auto.lo).toBeLessThanOrEqual(2491.23);
    expect(auto.hi).toBeGreaterThanOrEqual(2504.56);
    expect(auto.lo).toBeGreaterThan(2400);
    expect(scale([2491.23, 2504.56])).toMatchObject({ lo: 2491.23, hi: 2504.56 });
  });

  test('narrow ranges around large values keep distinct ticks through the upper bound', () => {
    const value = scale([999999999999, 1000000000001], ['auto', 'auto']);
    expect(value.ticks).toEqual([999999999999, 999999999999.5, 1000000000000, 1000000000000.5, 1000000000001]);
    expect(value.lo).toBe(999999999999);
    expect(value.hi).toBe(1000000000001);
  });

  test('ranges include every series and stack base and total', () => {
    const data = [
      { x: 'a', v: 20, w: 30, z: -10 },
      { x: 'b', v: 50, w: 40, z: 10 },
    ];
    const series: ChartSeries[] = [
      { type: 'bar', dataKey: 'v', stack: 's' },
      { type: 'area', dataKey: 'w', stack: 's' },
      { type: 'line', dataKey: 'z' },
    ];
    const extents = chartExtents(data, series);
    expect(chartValueScale(extents, series, DOMAIN)).toMatchObject({ lo: -10, hi: 90 });
    expect(chartValueScale(chartExtents(data, SERIES), SERIES, DOMAIN)).toMatchObject({ lo: 20, hi: 50 });
    const negative = [
      { type: 'area', dataKey: 'v', stack: 's' },
      { type: 'area', dataKey: 'w', stack: 's' },
    ] as const;
    expect(chartValueScale(chartExtents([{ v: -10, w: -20 }], negative), negative, DOMAIN)).toMatchObject({ lo: -30, hi: 0 });
  });

  test('area and bar baselines stay inside an explicitly cropped range', () => {
    for (const type of ['area', 'bar'] as const) {
      const g = chartGeometry({ ...INPUT, series: [{ type, dataKey: 'v', curveType: 'linear' }], yAxis: { domain: [2480, 2510] } });
      const paths = [...g.bars.map((b) => b.path), ...g.shapes.map((s) => s.area ?? '')].join(' ');
      expect(paths).not.toMatch(/NaN|Infinity/);
      const numbers = paths.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.every((n) => Math.abs(n) <= 320)).toBe(true);
    }
  });

  test('constant, absent, negative, subnormal and extreme data produce bounded finite geometry', () => {
    for (const values of [
      [],
      [0],
      [2500, 2500],
      [-2500, -2500],
      [1e300],
      [-1e300, 1e300],
      [5e-324],
      [0, 5e-324],
      [2490.000000000001, 2490.000000000002],
      [NaN, Infinity],
    ]) {
      const data = values.map((v, i) => ({ x: String(i), v }));
      const g = chartGeometry({ ...INPUT, data, yAxis: { domain: DOMAIN } });
      expect(g.ticks.length).toBeLessThanOrEqual(10);
      expect(g.ticks.every((t) => Number.isFinite(t.value) && Number.isFinite(t.y))).toBe(true);
      expect(g.shapes.map((s) => s.line).join(' ')).not.toMatch(/NaN|Infinity/);
      for (const point of g.shapes[0]?.points ?? []) {
        if (point === undefined) continue;
        expect(point.every(Number.isFinite)).toBe(true);
        expect(point[1]).toBeGreaterThanOrEqual(g.plot.top);
        expect(point[1]).toBeLessThanOrEqual(g.plot.bottom);
      }
    }
    expect(scale([2500]).lo).toBeLessThan(2500);
    expect(scale([2500]).hi).toBeGreaterThan(2500);
  });
});
