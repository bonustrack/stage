import { describe, expect, test } from 'bun:test';
import {
  chartAspectRatio, chartBarColor, chartGeometry, chartPrimitiveColor, chartSeriesColors, chartTicks, chartTooltipRows,
  chartXLabel, type ChartDatum, type ChartSeries,
} from '../src/chart';
import { chartAreaPath, chartCurvePath, type ChartPoint } from '../src/chart.curves';

const POINTS: ChartPoint[] = [[0, 10], [10, 20], [20, 5], [30, 15]];

describe('chartTicks', () => {
  test('matches the Recharts nice ticks of the ChatKit y axis', () => {
    expect(chartTicks(0, 41)).toEqual([0, 15, 30, 45, 60]);
    expect(chartTicks(0, 30)).toEqual([0, 8, 16, 24, 32]);
    expect(chartTicks(0, 0.3)).toEqual([0, 0.075, 0.15, 0.225, 0.3]);
    expect(chartTicks(0, 1234567)).toEqual([0, 350000, 700000, 1050000, 1400000]);
    expect(chartTicks(-18, 42)).toEqual([-20, 0, 20, 40, 60]);
    expect(chartTicks(0, 0)).toEqual([0, 1, 2, 3, 4]);
  });

  test('stays finite and short on extreme ranges', () => {
    for (const [min, max] of [[0, 1.7e308], [-1.7e308, 1.7e308], [0, 5e-324], [0, Number.MAX_VALUE]]) {
      const ticks = chartTicks(min ?? 0, max ?? 0);
      expect(ticks.length).toBeLessThanOrEqual(10);
      expect(ticks.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('chartSeriesColors', () => {
  test('assigns the ChatKit chart colours in order', () => {
    expect(chartSeriesColors([undefined, undefined, undefined], 'light')).toEqual(['#0285ff', '#924ff7', '#fb6a22']);
  });

  test('shades a colour shared by every series, and a repeated colour', () => {
    expect(chartSeriesColors(['blue'], 'light')).toEqual(['#0169cc']);
    expect(chartSeriesColors(['green', 'green'], 'dark')).toEqual(['#00a240', '#66d492']);
    expect(chartSeriesColors(['blue', 'blue', 'red'], 'light')).toEqual(['#0285ff', '#66b5ff', '#fa423e']);
    expect(chartSeriesColors(['blue', undefined, 'blue'], 'light')).toEqual(['#0285ff', '#924ff7', '#0169cc']);
  });

  test('resolves primitive tokens, Kit tokens, CSS colours and light/dark pairs', () => {
    const colors = chartSeriesColors(['red-100', { light: 'green', dark: 'pink' }, 'primary', '#123456', 'gray-500', 'blue-a50'], 'dark');
    expect(colors).toEqual(['#ffa4a2', '#ff66ad', '#ffffff', '#123456', '#5d5d5d', 'rgba(2, 133, 255, 0.13)']);
    expect(chartPrimitiveColor('alpha-10', 'light')).toBe('rgba(13, 13, 13, 0.1)');
    expect(chartPrimitiveColor('gray-900', 'dark')).toBe('#ededed');
    expect(chartPrimitiveColor('blue-450', 'light')).toBeUndefined();
  });

  test('gives each bar its own colour for one bar series without a colour', () => {
    const one: ChartSeries[] = [{ type: 'bar', dataKey: 'v' }];
    expect([0, 1, 7].map((i) => chartBarColor(one, ['#0285ff'], 0, i))).toEqual(['#0285ff', '#924ff7', '#0169cc']);
    const colored: ChartSeries[] = [{ type: 'bar', dataKey: 'v', color: 'red' }];
    expect(chartBarColor(colored, ['#e02e2a'], 0, 3)).toBe('#e02e2a');
  });
});

describe('chartCurvePath', () => {
  test('draws the d3 curves that ChatKit uses', () => {
    expect(chartCurvePath(POINTS, 'natural', 'line'))
      .toBe('M0,10C3.33,16.11,6.67,22.22,10,20C13.33,17.78,16.67,7.22,20,5C23.33,2.78,26.67,8.89,30,15');
    expect(chartCurvePath(POINTS, 'monotone', 'line')).toBe('M0,10C3.33,15,6.67,20,10,20C13.33,20,16.67,5,20,5C23.33,5,26.67,10,30,15');
    expect(chartCurvePath([[5, 100], [40, 30], [80, 30], [120, 90]], 'monotoneY', 'line'))
      .toBe('M5,100C10.83,76.67,16.67,53.33,40,30C40,30,80,30,80,30C106.67,50,113.33,70,120,90');
    expect(chartCurvePath(POINTS, 'step', 'line')).toBe('M0,10L5,10L5,20L15,20L15,5L25,5L25,15L30,15');
    expect(chartCurvePath(POINTS.slice(0, 2), 'basisClosed', 'line')).toBe('M6.67,16.67L3.33,13.33Z');
    expect(chartCurvePath([[3, 4]], 'natural', 'line')).toBe('M3,4Z');
  });

  test('closes areas on their base and flips step curves on the way back', () => {
    const base = POINTS.map(([x]): ChartPoint => [x, 50]);
    expect(chartAreaPath(POINTS, base, 'stepBefore'))
      .toBe('M0,10L0,20L10,20L10,5L20,5L20,15L30,15L30,50L20,50L20,50L10,50L10,50L0,50L0,50Z');
    expect(chartAreaPath(POINTS.slice(0, 2), base.slice(0, 2), 'basisOpen')).toBe('');
  });
});

const TWO_ROWS: ChartDatum[] = [{ d: 'a', v: 1, w: 2 }, { d: 'b', v: 3, w: 1 }];

describe('chartGeometry', () => {
  test('places bars like Recharts: 10% category gap, bar gap, 4px value end and 1px base corners', () => {
    const g = chartGeometry({
      data: TWO_ROWS, xAxis: 'd', width: 320, height: 240,
      series: [{ type: 'bar', dataKey: 'v' }, { type: 'bar', dataKey: 'w' }],
    });
    expect(g.plot).toEqual({ left: 5, top: 5, right: 315, bottom: 205 });
    expect(g.bars.map((b) => [b.series, b.index])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    expect(g.bars[0]?.path).toBe('M20.5,142.33A4,4,0,0,1,24.5,138.33L76.5,138.33A4,4,0,0,1,80.5,142.33L80.5,204A1,1,0,0,1,79.5,205L21.5,205A1,1,0,0,1,20.5,204Z');
    expect(g.bars[2]?.path.startsWith('M84.5,')).toBe(true);
    expect(g.labels.map((l) => l.text)).toEqual(['a', 'b']);
  });

  test('stacks bars in one slot with the end corners on the last series only', () => {
    const g = chartGeometry({
      data: [{ d: 'a', v: 1, w: 2 }], xAxis: 'd', width: 320, height: 240,
      series: [{ type: 'bar', dataKey: 'v', stack: 's' }, { type: 'bar', dataKey: 'w', stack: 's' }],
    });
    expect(g.bars.map((b) => b.path)).toEqual([
      'M36,138.33L284,138.33L284,204A1,1,0,0,1,283,205L37,205A1,1,0,0,1,36,204Z',
      'M36,9A4,4,0,0,1,40,5L280,5A4,4,0,0,1,284,9L284,138.33L36,138.33Z',
    ]);
  });

  test('rounds a negative bar at its value end, below the zero line', () => {
    const g = chartGeometry({ data: [{ q: 'Q1', p: 42 }, { q: 'Q2', p: -18 }], xAxis: 'q', width: 320, height: 240, series: [{ type: 'bar', dataKey: 'p' }] });
    expect(g.ticks.map((t) => t.label)).toEqual(['-20', '0', '20', '40', '60']);
    expect(g.ticks[1]?.y).toBe(155);
    expect(g.bars[1]?.path).toBe('M175.5,196A4,4,0,0,0,179.5,200L295.5,200A4,4,0,0,0,299.5,196L299.5,156A1,1,0,0,0,298.5,155L176.5,155A1,1,0,0,0,175.5,156Z');
  });

  test('spreads line points edge to edge and breaks lines at missing values', () => {
    const data: ChartDatum[] = [{ d: 'a', v: 1 }, { d: 'b', v: 2 }, { d: 'c', v: 'n/a' }, { d: 'd', v: 4 }, { d: 'e', v: 5 }];
    const g = chartGeometry({ data, xAxis: 'd', width: 320, height: 240, series: [{ type: 'line', dataKey: 'v' }, { type: 'area', dataKey: 'v' }] });
    expect(g.categories[0]?.x).toBe(g.plot.left);
    expect(g.categories[4]?.x).toBe(g.plot.right);
    expect(g.shapes[0]?.line.match(/M/g)?.length).toBe(2);
    expect(g.shapes[0]?.points[2]).toBeUndefined();
    expect(g.shapes[1]?.area?.endsWith('Z')).toBe(true);
  });

  test('thins x labels from the end, keeps the first and last inside, and hides them with the axis', () => {
    const data: ChartDatum[] = Array.from({ length: 30 }, (_, i) => ({ d: `Day ${i + 1}`, v: i }));
    const g = chartGeometry({ data, xAxis: 'd', width: 320, height: 240, series: [{ type: 'line', dataKey: 'v' }] });
    expect(g.labels.length).toBeGreaterThan(2);
    expect(g.labels.length).toBeLessThan(30);
    expect(g.labels[g.labels.length - 1]?.index).toBe(29);
    for (const [i, label] of g.labels.entries()) {
      const next = g.labels[i + 1];
      if (next !== undefined) expect(next.x - label.x).toBeGreaterThan(10);
    }
    const hidden = chartGeometry({ data, xAxis: { dataKey: 'd', hide: true }, width: 320, height: 240, series: [{ type: 'line', dataKey: 'v' }] });
    expect(hidden.labels).toEqual([]);
    expect(hidden.plot.bottom).toBe(240 - 7 - 5);
  });

  test('never puts NaN or Infinity in a path, whatever the numbers', () => {
    const cases: { data: ChartDatum[]; series: ChartSeries[] }[] = [
      { data: [{ x: 'a', v: 1.7e308 }], series: [{ type: 'bar', dataKey: 'v' }] },
      { data: [{ x: 'a', v: 1e300, w: 1e300 }], series: [{ type: 'bar', dataKey: 'v', stack: 's' }, { type: 'area', dataKey: 'w', stack: 's' }] },
      { data: [{ x: 'a', v: -1e300 }, { x: 'b', v: 1e300 }], series: [{ type: 'bar', dataKey: 'v' }, { type: 'line', dataKey: 'v' }] },
      { data: [{ x: 'a', v: 5e-324 }, { x: 'b', v: 0 }], series: [{ type: 'line', dataKey: 'v' }] },
    ];
    for (const { data, series } of cases) {
      const g = chartGeometry({ data, series, xAxis: 'x', width: 320, height: 240, showYAxis: true });
      const paths = [...g.bars.map((b) => b.path), ...g.shapes.flatMap((sh) => [sh.line, sh.area ?? ''])].join(' ');
      expect(paths).not.toMatch(/NaN|Infinity/);
      const numbers = [
        ...g.ticks.flatMap((t) => [t.value, t.y]), ...Object.values(g.plot),
        ...g.shapes.flatMap((sh) => sh.points.flatMap((p) => p ?? [])),
      ];
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
  });

  test('draws a dot for a point with no neighbours', () => {
    const data: ChartDatum[] = [{ d: 'a', v: 1 }, { d: 'b', v: 'n/a' }, { d: 'c', v: 3 }, { d: 'd', v: 4 }, { d: 'e', v: '' }, { d: 'f', v: 6 }];
    const g = chartGeometry({ data, xAxis: 'd', width: 320, height: 240, series: [{ type: 'line', dataKey: 'v' }] });
    expect(g.shapes[0]?.dots.map((p) => p[0])).toEqual([g.categories[0]?.x, g.categories[5]?.x]);
  });

  test('makes room for the y axis and the legend', () => {
    const base = { data: TWO_ROWS, xAxis: 'd', width: 320, height: 240, series: [{ type: 'bar', dataKey: 'v' }] } as const;
    expect(chartGeometry({ ...base, showYAxis: true }).plot.left).toBeGreaterThan(5);
    expect(chartGeometry({ ...base, legend: true }).plot.bottom).toBe(240 - 30);
  });
});

describe('chart helpers', () => {
  test('tooltip rows name series by label, fall back to the data key, and skip missing values', () => {
    const series: ChartSeries[] = [{ type: 'bar', dataKey: 'web', label: 'Web' }, { type: 'line', dataKey: 'app' }, { type: 'line', dataKey: 'tv' }];
    expect(chartTooltipRows(series, { web: 1234, app: '7' })).toEqual([
      { series: 0, name: 'Web', value: (1234).toLocaleString() },
      { series: 1, name: 'app', value: '7' },
    ]);
    expect(chartTooltipRows([{ type: 'bar', dataKey: 'v' }], { v: 3 })).toEqual([{ series: 0, value: '3' }]);
  });

  test('x labels map through xAxis.labels', () => {
    expect(chartXLabel({ dataKey: 'd', labels: { mon: 'Monday' } }, { d: 'mon' })).toBe('Monday');
    expect(chartXLabel('d', { d: 7 })).toBe('7');
  });

  test('aspect ratios take numbers and ChatKit strings', () => {
    expect(chartAspectRatio('16/9')).toBeCloseTo(16 / 9);
    expect(chartAspectRatio('1.5')).toBe(1.5);
    expect(chartAspectRatio(2)).toBe(2);
    expect(chartAspectRatio('wide')).toBeCloseTo(4 / 3);
    expect(chartAspectRatio(undefined)).toBeCloseTo(4 / 3);
  });
});
