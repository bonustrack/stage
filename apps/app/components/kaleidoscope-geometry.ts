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

/** Sharp outer triangular petal radiating from centre to the rim. `reach`
 *  drives the morph (the petal grows / shrinks as the wheel breathes). */
export function wedgeTriangle(reach: number): string {
  const tip = CENTER - reach;
  const halfWidth = reach * 0.22;
  return `M${CENTER} ${CENTER} L${CENTER + halfWidth} ${tip} L${CENTER - halfWidth} ${tip} Z`;
}

/** Slim inner shard, a thinner counter-petal for depth between the triangles. */
export function wedgeShard(reach: number): string {
  const tip = CENTER - reach * 0.62;
  const ctrl = CENTER - reach * 0.3;
  const w = reach * 0.06;
  return `M${CENTER} ${CENTER} L${CENTER + w} ${ctrl} Q${CENTER} ${tip} ${CENTER - w} ${ctrl} Z`;
}

/** Scalloped flower centre: a ring of bulging arcs forming a petal-edged disc. */
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
