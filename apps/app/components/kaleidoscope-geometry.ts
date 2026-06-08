/** Geometry helpers for KaleidoscopeSplash.
 *
 *  All paths live in a 100x100 viewBox centred at (50,50). A single wedge is
 *  drawn once and rotated N times to build the radial, mirror-symmetric bloom.
 *  Pure math, no react-native deps, so it is trivially testable / reusable. */

export const CENTER = 50;
export const SEGMENTS = 16; // N-fold rotational symmetry (mirrored bloom)

/** Flat, vivid bloom palette. Keeps Less's teal in rotation. No gradients. */
export const PALETTE = {
  field: '#0E1726', // flat deep navy backdrop, fills the whole screen
  petalA: ['#19C2B0', '#FF4FB6', '#FFC24B'], // teal -> hot pink -> amber
  petalB: ['#5BE0FF', '#A24BFF', '#FF6B6B'], // cyan -> violet -> coral
  shard: ['#FFFFFF', '#19C2B0', '#FF4FB6'], // bright -> teal -> pink
};

/** Scalloped flower centre: a ring of bulging arcs forming a petal-edged disc.
 *  Computed once on the JS thread (the flower is static; only its fill animates),
 *  so this helper is intentionally NOT a worklet. */
/** Petals reach past the corners of a 100x100 viewBox (half-diagonal ~= 70.7)
 *  so the bloom bleeds edge to edge with `slice`. The reach breathes between
 *  these bounds to drive the morph. */
export const REACH_MIN = 60;
export const REACH_MAX = 78;

/** Pure-JS hex colour lerp. `t` in 0..1 across a [a, mid, b] 3-stop palette.
 *  Replaces reanimated interpolateColor so the colour cycle runs on the JS
 *  thread (no worklet, works regardless of the native reanimated module). */
function lerpHex(a: string, b: string, t: number): string {
  const ai = parseInt(a.slice(1), 16);
  const bi = parseInt(b.slice(1), 16);
  const ar = (ai >> 16) & 255;
  const ag = (ai >> 8) & 255;
  const ab = ai & 255;
  const br = (bi >> 16) & 255;
  const bg = (bi >> 8) & 255;
  const bb = bi & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Interpolate a flat colour across a 3-stop [a, mid, b] palette by t (0..1). */
export function cycleColor(stops: string[], t: number): string {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (clamped < 0.5) return lerpHex(stops[0], stops[1], clamped * 2);
  return lerpHex(stops[1], stops[2], (clamped - 0.5) * 2);
}

/** Build the three wedge path strings (sharp petal, shorter petal, slim shard)
 *  for a given reach. Plain math computed each frame on the JS thread. */
export function wedgePaths(reach: number): { tri: string; triAlt: string; shard: string } {
  const tipFor = (r: number): string => {
    const tip = CENTER - r;
    const hw = r * 0.22;
    return `M${CENTER} ${CENTER} L${CENTER + hw} ${tip} L${CENTER - hw} ${tip} Z`;
  };
  const sr = reach;
  const shTip = CENTER - sr * 0.62;
  const shCtrl = CENTER - sr * 0.3;
  const shW = sr * 0.06;
  return {
    tri: tipFor(reach),
    triAlt: tipFor(reach * 0.82),
    shard: `M${CENTER} ${CENTER} L${CENTER + shW} ${shCtrl} Q${CENTER} ${shTip} ${CENTER - shW} ${shCtrl} Z`,
  };
}

export function flowerPath(r: number, petals: number): string {
  let d = '';
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * Math.PI * 2;
    const a1 = ((i + 1) / petals) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const x0 = CENTER + r * Math.cos(a0);
    const y0 = CENTER + r * Math.sin(a0);
    const x1 = CENTER + r * Math.cos(a1);
    const y1 = CENTER + r * Math.sin(a1);
    const bulge = r * 1.32;
    const xm = CENTER + bulge * Math.cos(am);
    const ym = CENTER + bulge * Math.sin(am);
    d += i === 0 ? `M${x0.toFixed(2)} ${y0.toFixed(2)} ` : '';
    d += `Q${xm.toFixed(2)} ${ym.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)} `;
  }
  return `${d}Z`;
}
