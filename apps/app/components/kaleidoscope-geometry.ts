/** Geometry + defaults for KaleidoscopeSplash.
 *
 *  FAITHFUL PORT of bloom.mocha.app (the Mocha kaleidoscope generator). The
 *  source is a client-side canvas/SVG app; its renderer tiles a single vector
 *  "logo" path into N mirror-symmetric wedge sectors around the centre. We
 *  reproduce the exact geometry, the exact default graphic path, and the exact
 *  default palette extracted from the app's JS bundle.
 *
 *  Mocha render algorithm (per sector i in [0, sectors)):
 *    translate(cx, cy)
 *    rotate(i * 2*PI / sectors)
 *    clip to a wedge spanning [-d/2, d/2] where d = 2*PI / sectors
 *    if (i % 2 === 0) scale(-1, 1)            // mirror -> kaleidoscope symmetry
 *    translate(offsetDistance, 0)
 *    rotate(rotation deg)
 *    scale(scale * logoSize)
 *    draw the logo path centred on the local origin
 *
 *  Mocha defaults (verbatim from the bundle):
 *    graphicColor #B5FF6B, bgColor #056117, scale 1.4, logoSize 1,
 *    rotation 62, tilingRotation 0, globalRotation 0, sectors 14,
 *    offsetDistance 0, repeat 1, circularMask false.
 *
 *  Pure math, no react-native deps, so it is trivially testable / reusable. */

/** The default graphic path tiled by the kaleidoscope, lifted verbatim from the
 *  Mocha bundle. Authored in a 734x422 box; we centre it on its own bbox so the
 *  per-sector transforms rotate/scale it about its middle (as the app does by
 *  drawing the image centred). */
export const LOGO_PATH =
  'M451.156 29.1278C480.858 -22.3151 559.5 -1.24308 559.503 58.1586V158.421C560.164 215.271 634.276 235.918 664.529 188.921L700.664 126.338C705.597 117.794 716.523 114.865 725.067 119.798C733.61 124.731 736.536 135.656 731.604 144.2L651.144 283.565H651.137L588.062 392.815C558.36 444.26 479.717 423.191 479.715 363.788V263.397C478.967 208.072 408.622 187.129 377.073 229.606L345.923 283.561H345.919L282.84 392.819C253.138 444.262 174.495 423.19 174.494 363.788L174.49 263.34C173.675 206.665 99.7917 186.103 69.5317 232.926L33.3388 295.612C28.4053 304.156 17.4807 307.084 8.93626 302.153C0.3917 297.219 -2.53708 286.291 2.39603 277.746L145.935 29.1278C175.636 -22.3139 254.273 -1.24515 254.277 58.1551V158.303C254.823 213.798 325.305 234.866 356.909 192.359L451.156 29.1278Z';

/** Native size of the logo path's authoring box (from the source <svg>). */
export const LOGO_W = 734;
export const LOGO_H = 422;

/** Faithful Mocha default settings (verbatim from the bundle). */
export const MOCHA_DEFAULTS = {
  graphicColor: '#B5FF6B',
  bgColor: '#056117',
  scale: 1.4,
  logoSize: 1,
  rotation: 62,
  tilingRotation: 0,
  globalRotation: 0,
  sectors: 14,
  offsetDistance: 0,
  repeat: 1,
  circularMask: false,
} as const;

/** The 16 flat palette swatches the app ships (name + hex), in app order. Less's
 *  teal (#006161) is one of them, so the splash already carries his colour. */
export const MOCHA_PALETTE = [
  '#F9F8F0', // Off White
  '#000000', // Black
  '#FFFFFF', // Pure White
  '#E6DBC1', // Cream
  '#056117', // Green
  '#B5FF6B', // Lime
  '#006161', // Teal
  '#60E2E2', // Cyan
  '#003980', // Blue
  '#61A8FF', // Sky Blue
  '#7E1660', // Purple
  '#FF75F8', // Pink
  '#6D2225', // Red
  '#FF7575', // Coral
  '#AD5A00', // Orange
  '#FFC180', // Peach
] as const;

/** A wedge clip path for one sector, in the sector's local frame (origin at the
 *  centre, +x to the right). Spans the half-angle each side and reaches out to
 *  `radius` so it covers the full screen. Mirrors the app's createWedgeClip:
 *  moveTo(0,0); arc(0,0,R,-d/2,d/2); closePath. We approximate the arc with two
 *  straight edges plus an SVG arc command. */
export function wedgeClipPath(sectors: number, radius: number): string {
  const half = Math.PI / sectors;
  const x0 = radius * Math.cos(-half);
  const y0 = radius * Math.sin(-half);
  const x1 = radius * Math.cos(half);
  const y1 = radius * Math.sin(half);
  return `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A${radius} ${radius} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
}
