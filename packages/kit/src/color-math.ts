
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

function toByte(n: number): string {
  return Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
}

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

function normalizeHexDigits(hex: string): string | null {
  const t = hex.trim();
  const six = /^#?([0-9a-f]{6})$/i.exec(t);
  if (six?.[1] !== undefined) return six[1];
  const short = /^#?([0-9a-f]{3})$/i.exec(t);
  if (short?.[1] !== undefined) return short[1].split('').map((c) => c + c).join('');
  return null;
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

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(v: string): boolean { return HEX_RE.test(v.trim()); }

const HSL_SECTORS: readonly (readonly [number, number, number])[] = [
  [1, 2, 0], [2, 1, 0], [0, 1, 2], [0, 2, 1], [2, 0, 1], [1, 0, 2],
];

function sectorChannels(hh: number, c: number, x: number): [number, number, number] {
  const parts = [0, c, x];
  const sector = HSL_SECTORS[Math.floor(hh) % 6] ?? HSL_SECTORS[0];
  const pick = (i: number): number => parts[sector?.[i] ?? 0] ?? 0;
  return [pick(0), pick(1), pick(2)];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 60;
  const li = clamp01(l);
  const c = (1 - Math.abs(2 * li - 1)) * clamp01(s);
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = li - c / 2;
  const [r, g, b] = sectorChannels(hh, c, x);
  return `#${toByte(r + m)}${toByte(g + m)}${toByte(b + m)}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const digits = normalizeHexDigits(hex);
  if (digits == null) return { h: 0, s: 0, l: 0 };
  const int = parseInt(digits, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const denom = 1 - Math.abs(2 * l - 1);
  return { h: rgbToHue(r, g, b, max, d), s: denom === 0 ? 0 : d / denom, l };
}
