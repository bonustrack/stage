export type Rgb = [number, number, number];

export interface HexParseOptions {
  short?: boolean;
  bare?: boolean;
}

export const LUMA_REC601: Readonly<Rgb> = [0.299, 0.587, 0.114];
export const LUMA_REC709: Readonly<Rgb> = [0.2126, 0.7152, 0.0722];

const HEX_RRGGBB = /^#([0-9a-fA-F]{6})$/;
const HEX_RGB_OR_RRGGBB = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function byteHex(n: number): string {
  const byte = n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
  return byte.toString(16).padStart(2, '0');
}

export function parseHex(hex: string, options: HexParseOptions = {}): Rgb | null {
  const trimmed = hex.trim();
  const value = options.bare === true && !trimmed.startsWith('#') ? `#${trimmed}` : trimmed;
  const digits = (options.short === true ? HEX_RGB_OR_RRGGBB : HEX_RRGGBB).exec(value)?.[1];
  if (digits === undefined) return null;
  const full = digits.length === 3 ? Array.from(digits, (c) => c + c).join('') : digits;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function formatHex([r, g, b]: Readonly<Rgb>): string {
  return `#${byteHex(r)}${byteHex(g)}${byteHex(b)}`;
}

export function formatRgba([r, g, b]: Readonly<Rgb>, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return rgb === null ? hex : formatRgba(rgb, alpha);
}

export function luminance([r, g, b]: Readonly<Rgb>, [wr, wg, wb]: Readonly<Rgb> = LUMA_REC601): number {
  return (wr * r + wg * g + wb * b) / 255;
}

export function isHexColor(v: string): boolean {
  return parseHex(v) !== null;
}

function unitHex(r: number, g: number, b: number): string {
  return formatHex([clamp01(r) * 255, clamp01(g) * 255, clamp01(b) * 255]);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = clamp01(v) * clamp01(s);
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = clamp01(v) - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) {
    r = c;
    g = x;
  } else if (hh < 2) {
    r = x;
    g = c;
  } else if (hh < 3) {
    g = c;
    b = x;
  } else if (hh < 4) {
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return unitHex(r + m, g + m, b + m);
}

function rgbToHue(r: number, g: number, b: number, max: number, d: number): number {
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

interface RgbStats {
  r: number;
  g: number;
  b: number;
  max: number;
  min: number;
  d: number;
}

function hexToRgbStats(hex: string): RgbStats | null {
  const rgb = parseHex(hex, { short: true, bare: true });
  if (rgb === null) return null;
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { r, g, b, max, min, d: max - min };
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const c = hexToRgbStats(hex);
  if (c == null) return { h: 0, s: 0, v: 0 };
  return { h: rgbToHue(c.r, c.g, c.b, c.max, c.d), s: c.max === 0 ? 0 : c.d / c.max, v: c.max };
}

const HSL_SECTORS: readonly (readonly [number, number, number])[] = [
  [1, 2, 0],
  [2, 1, 0],
  [0, 1, 2],
  [0, 2, 1],
  [2, 0, 1],
  [1, 0, 2],
];

function sectorChannels(hh: number, c: number, x: number): [number, number, number] {
  const parts = [0, c, x];
  const sector = HSL_SECTORS[Math.floor(hh) % 6] ?? HSL_SECTORS[0];
  const pick = (i: number): number => parts[sector?.[i] ?? 0] ?? 0;
  return [pick(0), pick(1), pick(2)];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 60;
  const li = clamp01(l);
  const c = (1 - Math.abs(2 * li - 1)) * clamp01(s);
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = li - c / 2;
  const [r, g, b] = sectorChannels(hh, c, x);
  return unitHex(r + m, g + m, b + m);
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const c = hexToRgbStats(hex);
  if (c == null) return { h: 0, s: 0, l: 0 };
  const l = (c.max + c.min) / 2;
  const denom = 1 - Math.abs(2 * l - 1);
  return { h: rgbToHue(c.r, c.g, c.b, c.max, c.d), s: denom === 0 ? 0 : c.d / denom, l };
}
