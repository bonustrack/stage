export type ChartPoint = readonly [number, number];

export const CHART_CURVE_TYPES = [
  'basis', 'basisClosed', 'basisOpen', 'bumpX', 'bumpY', 'bump', 'linear', 'linearClosed', 'natural',
  'monotoneX', 'monotoneY', 'monotone', 'step', 'stepBefore', 'stepAfter',
] as const;

export type ChartCurveType = (typeof CHART_CURVE_TYPES)[number];

export type ChartCurveMode = 'line' | 'area' | 'base';

interface Pen {
  out: string[];
  swap: boolean;
  join: boolean;
}

type Curve = (points: readonly ChartPoint[], pen: Pen) => void;

function num(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}

function xy(pen: Pen, x: number, y: number): string {
  return pen.swap ? `${num(y)},${num(x)}` : `${num(x)},${num(y)}`;
}

function start(pen: Pen, x: number, y: number): void {
  pen.out.push(`${pen.join ? 'L' : 'M'}${xy(pen, x, y)}`);
}

function line(pen: Pen, x: number, y: number): void {
  pen.out.push(`L${xy(pen, x, y)}`);
}

function cubic(pen: Pen, c: readonly [number, number, number, number, number, number]): void {
  pen.out.push(`C${xy(pen, c[0], c[1])},${xy(pen, c[2], c[3])},${xy(pen, c[4], c[5])}`);
}

function at(points: readonly ChartPoint[], i: number): ChartPoint {
  return points[i] ?? [0, 0];
}

const linear: Curve = (points, pen) => {
  points.forEach(([x, y], i) => { (i === 0 ? start : line)(pen, x, y); });
};

function stepCurve(t: number): Curve {
  return (points, pen) => {
    points.forEach(([x, y], i) => {
      if (i === 0) { start(pen, x, y); return; }
      const [px, py] = at(points, i - 1);
      if (t <= 0) { line(pen, px, y); line(pen, x, y); return; }
      const mid = px * (1 - t) + x * t;
      line(pen, mid, py);
      line(pen, mid, y);
    });
    const last = points[points.length - 1];
    if (t > 0 && t < 1 && points.length > 1 && last !== undefined) line(pen, last[0], last[1]);
  };
}

function controlPoints(v: readonly number[]): [number[], number[]] {
  const n = v.length - 1;
  const a: number[] = new Array<number>(n).fill(0);
  const b: number[] = new Array<number>(n).fill(0);
  const r: number[] = new Array<number>(n).fill(0);
  const get = (arr: readonly number[], i: number): number => arr[i] ?? 0;
  a[0] = 0; b[0] = 2; r[0] = get(v, 0) + 2 * get(v, 1);
  for (let i = 1; i < n - 1; i += 1) { a[i] = 1; b[i] = 4; r[i] = 4 * get(v, i) + 2 * get(v, i + 1); }
  a[n - 1] = 2; b[n - 1] = 7; r[n - 1] = 8 * get(v, n - 1) + get(v, n);
  for (let i = 1; i < n; i += 1) {
    const m = get(a, i) / get(b, i - 1);
    b[i] = get(b, i) - m;
    r[i] = get(r, i) - m * get(r, i - 1);
  }
  a[n - 1] = get(r, n - 1) / get(b, n - 1);
  for (let i = n - 2; i >= 0; i -= 1) a[i] = (get(r, i) - get(a, i + 1)) / get(b, i);
  b[n - 1] = (get(v, n) + get(a, n - 1)) / 2;
  for (let i = 0; i < n - 1; i += 1) b[i] = 2 * get(v, i + 1) - get(a, i + 1);
  return [a, b];
}

const natural: Curve = (points, pen) => {
  if (points.length < 3) { linear(points, pen); return; }
  const [ax, bx] = controlPoints(points.map((p) => p[0]));
  const [ay, by] = controlPoints(points.map((p) => p[1]));
  start(pen, at(points, 0)[0], at(points, 0)[1]);
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = at(points, i);
    cubic(pen, [ax[i - 1] ?? x, ay[i - 1] ?? y, bx[i - 1] ?? x, by[i - 1] ?? y, x, y]);
  }
};

function sign(n: number): number {
  return n < 0 ? -1 : 1;
}

function slope3(p0: ChartPoint, p1: ChartPoint, p2: ChartPoint): number {
  const h0 = p1[0] - p0[0];
  const h1 = p2[0] - p1[0];
  const s0 = (p1[1] - p0[1]) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (p2[1] - p1[1]) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

function slope2(p0: ChartPoint, p1: ChartPoint, t: number): number {
  const h = p1[0] - p0[0];
  return h === 0 ? t : (3 * (p1[1] - p0[1]) / h - t) / 2;
}

function hermite(pen: Pen, p0: ChartPoint, p1: ChartPoint, t0: number, t1: number): void {
  const dx = (p1[0] - p0[0]) / 3;
  cubic(pen, [p0[0] + dx, p0[1] + dx * t0, p1[0] - dx, p1[1] - dx * t1, p1[0], p1[1]]);
}

function distinct(points: readonly ChartPoint[]): ChartPoint[] {
  return points.filter((p, i) => i === 0 || p[0] !== at(points, i - 1)[0] || p[1] !== at(points, i - 1)[1]);
}

const monotone: Curve = (raw, pen) => {
  const points = distinct(pen.swap ? raw.map(([x, y]): ChartPoint => [y, x]) : raw);
  if (points.length < 3) { linear(points, pen); return; }
  start(pen, at(points, 0)[0], at(points, 0)[1]);
  let t0 = slope3(at(points, 0), at(points, 1), at(points, 2));
  hermite(pen, at(points, 0), at(points, 1), slope2(at(points, 0), at(points, 1), t0), t0);
  for (let i = 2; i < points.length - 1; i += 1) {
    const t1 = slope3(at(points, i - 1), at(points, i), at(points, i + 1));
    hermite(pen, at(points, i - 1), at(points, i), t0, t1);
    t0 = t1;
  }
  const n = points.length;
  hermite(pen, at(points, n - 2), at(points, n - 1), t0, slope2(at(points, n - 2), at(points, n - 1), t0));
};

function bspline(pen: Pen, a: ChartPoint, b: ChartPoint, c: ChartPoint): void {
  cubic(pen, [
    (2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3, (a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3,
    (a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6,
  ]);
}

const basis: Curve = (points, pen) => {
  if (points.length < 3) { linear(points, pen); return; }
  const first = at(points, 0);
  const second = at(points, 1);
  start(pen, first[0], first[1]);
  line(pen, (5 * first[0] + second[0]) / 6, (5 * first[1] + second[1]) / 6);
  for (let i = 2; i < points.length; i += 1) bspline(pen, at(points, i - 2), at(points, i - 1), at(points, i));
  const n = points.length;
  bspline(pen, at(points, n - 2), at(points, n - 1), at(points, n - 1));
  line(pen, at(points, n - 1)[0], at(points, n - 1)[1]);
};

const basisOpen: Curve = (points, pen) => {
  if (points.length < 3) return;
  const [a, b, c] = [at(points, 0), at(points, 1), at(points, 2)];
  start(pen, (a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6);
  for (let i = 3; i < points.length; i += 1) bspline(pen, at(points, i - 2), at(points, i - 1), at(points, i));
};

const basisClosed: Curve = (points, pen) => {
  const [a, b] = [at(points, 0), at(points, 1)];
  if (points.length >= 3) { basisOpen([...points, a, b, at(points, 2)], pen); return; }
  if (points.length === 2) {
    start(pen, (a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3);
    line(pen, (b[0] + 2 * a[0]) / 3, (b[1] + 2 * a[1]) / 3);
  } else {
    start(pen, a[0], a[1]);
  }
  pen.out.push('Z');
};

function bumpCurve(alongX: boolean): Curve {
  return (points, pen) => {
    points.forEach(([x, y], i) => {
      if (i === 0) { start(pen, x, y); return; }
      const [px, py] = at(points, i - 1);
      const mx = (px + x) / 2;
      const my = (py + y) / 2;
      cubic(pen, alongX ? [mx, py, mx, y, x, y] : [px, my, x, my, x, y]);
    });
  };
}

const closed: Curve = (points, pen) => {
  linear(points, pen);
  pen.out.push('Z');
};

const CURVES: Record<ChartCurveType, Curve> = {
  basis, basisClosed, basisOpen, bumpX: bumpCurve(true), bumpY: bumpCurve(false), bump: bumpCurve(true),
  linear, linearClosed: closed, natural, monotoneX: monotone, monotoneY: monotone, monotone,
  step: stepCurve(0.5), stepBefore: stepCurve(0), stepAfter: stepCurve(1),
};

const CLOSED_TO_OPEN: Partial<Record<ChartCurveType, ChartCurveType>> = { basisClosed: 'basis', linearClosed: 'linear' };

const STEP_FLIP: Partial<Record<ChartCurveType, ChartCurveType>> = { stepBefore: 'stepAfter', stepAfter: 'stepBefore' };

function curveFor(curve: ChartCurveType, mode: ChartCurveMode): ChartCurveType {
  if (mode === 'line') return curve;
  const open = CLOSED_TO_OPEN[curve] ?? curve;
  return mode === 'base' ? STEP_FLIP[open] ?? open : open;
}

export function chartCurvePath(points: readonly ChartPoint[], curve: ChartCurveType, mode: ChartCurveMode): string {
  if (points.length === 0) return '';
  const pen: Pen = { out: [], swap: curve === 'monotoneY', join: mode === 'base' };
  CURVES[curveFor(curve, mode)](points, pen);
  if (mode === 'line' && pen.out.length === 1) pen.out.push('Z');
  return pen.out.join('');
}

export function chartAreaPath(top: readonly ChartPoint[], base: readonly ChartPoint[], curve: ChartCurveType): string {
  const upper = chartCurvePath(top, curve, 'area');
  return upper === '' ? '' : `${upper}${chartCurvePath([...base].reverse(), curve, 'base')}Z`;
}
