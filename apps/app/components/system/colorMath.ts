/**
 * @file Pure-JS, dependency-free HSV <-> hex color conversions for the color
 *  picker (h in [0,360], s/v in [0,1], hex as `#rrggbb`).
 */

/** Clamp01 helper. */
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

/** To Byte. */
function toByte(n: number): string {
  return Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
}

/** HSV -> `#rrggbb`. */
export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360 / 60;
  const c = clamp01(v) * clamp01(s);
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = clamp01(v) - c;
  let r = 0; let g = 0; let b = 0;
  if (hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  return `#${toByte(r + m)}${toByte(g + m)}${toByte(b + m)}`;
}

/** Normalize a hex string to 6 lowercase hex digits, or null on bad input. */
function normalizeHexDigits(hex: string): string | null {
  const t = hex.trim();
  const six = /^#?([0-9a-f]{6})$/i.exec(t);
  if (six?.[1] !== undefined) return six[1];
  const short = /^#?([0-9a-f]{3})$/i.exec(t);
  if (short?.[1] !== undefined) return short[1].split('').map((c) => c + c).join('');
  return null;
}

/** Compute hue (deg) from normalized rgb channels and their max/delta. */
function rgbToHue(r: number, g: number, b: number, max: number, d: number): number {
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** `#rrggbb` (or `#rgb`) -> HSV. Falls back to black on bad input. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const digits = normalizeHexDigits(hex);
  if (digits == null) return { h: 0, s: 0, v: 0 };
  const int = parseInt(digits, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const s = max === 0 ? 0 : d / max;
  return { h: rgbToHue(r, g, b, max, d), s, v: max };
}
