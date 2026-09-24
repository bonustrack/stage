export const HERO_YELLOW = '#fafe69';
export const HERO_BLACK = '#000000';
export const HERO_WHITE = '#ffffff';

export const HERO_COPY = {
  eyebrow: 'Private by default',
  title: 'Your agent is the product',
  paragraph:
    'Stage is a private, end-to-end encrypted messenger with a built-in wallet, free usernames and avatars. Groups, multiple accounts, and agents as contacts.',
  cta: 'Get started →',
} as const;

export const BANNER = {
  lead: 'Psst! Stage is in early access. ',
  link: 'Claim your free username',
  tail: '. →',
  copies: 3,
  size: 19,
  lineHeight: 29,
  padY: 12,
  padRight: 64,
  durationMs: 10_000,
} as const;

export const BANNER_HEIGHT = BANNER.lineHeight + 2 * BANNER.padY;

export const HERO_LAYOUT = {
  containerMaxWidth: 1400,
  containerPadX: 32,
  contentPadY: 12,
  contentPadBottom: 120,
  contentGap: 40,
  blockMaxWidth: 760,
  blockPadY: 16,
  bandHeight: 540,
  headerPadY: 40,
  logoHeight: 66,
  logoPadX: 32,
  logoPadY: 14,
  boxFrameHeight: 600,
  ctaPadX: 24,
  ctaPadY: 12,
} as const;

export const HERO_LOGO_SIZE = HERO_LAYOUT.logoHeight - 2 * HERO_LAYOUT.logoPadY;

export const HERO_TYPE = {
  eyebrow: { size: 17, letterSpacing: 1.7 },
  title: { size: 76, lineHeight: 83.6 },
  paragraph: { size: 26, lineHeight: 31.2 },
  cta: { size: 19, lineHeight: 29 },
} as const;

export interface HeroBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeroBoxLayer {
  color: string;
  count: number;
  top: (heroHeight: number) => number;
}

export const HERO_BOX_LAYERS: readonly HeroBoxLayer[] = [
  { color: HERO_YELLOW, count: 4, top: (heroHeight) => heroHeight - 160 - HERO_LAYOUT.boxFrameHeight },
  { color: HERO_WHITE, count: 6, top: () => 320 },
];

export function heroBoxes(count: number, frameWidth: number, frameHeight: number, random: () => number): HeroBox[] {
  return Array.from({ length: count }, () => {
    const width = Math.floor(random() * (frameWidth * 0.1) + frameWidth * 0.2);
    const height = Math.floor(random() * (frameHeight * 0.1) + frameHeight * 0.3);
    return {
      x: Math.floor(random() * (frameWidth - width * 0.4) - width * 0.3),
      y: Math.floor(random() * (frameHeight - height * 0.4) - height * 0.3),
      width,
      height,
    };
  });
}

export const ASCII = {
  chars: [' ', '⋅', '.', '^', ' '] as const,
  size: 14,
  lineHeight: 8,
  letterSpacing: -1,
  cellWidth: 7.6,
  maxWidth: 1500,
  tickMs: 100,
  tickStep: 0.04,
} as const;

export const ASCII_GLYPH = {
  pitch: 7.4287109375,
  baseline: 8.5,
  caret: { left: 0.25, right: 8.18, top: 10.17, bottom: 6.1, leg: 2.1, apex: 2.1 },
  period: { left: 2.66, right: 5.07, top: 2.76, bottom: 0 },
  dot: { left: 3.34, right: 5.07, top: 5.91, bottom: 3.82 },
} as const;

export interface GlyphRect { x: number; y: number; width: number; height: number }

export function asciiOrigin(width: number, height: number, cols: number, rows: number): { x: number; y: number } {
  return { x: (width - cols * ASCII_GLYPH.pitch) / 2, y: (height - rows * ASCII.lineHeight) / 2 };
}

export function glyphRect(ch: string, x: number, baseline: number): GlyphRect | null {
  const box = ch === '.' ? ASCII_GLYPH.period : ch === '⋅' ? ASCII_GLYPH.dot : null;
  if (box === null) return null;
  return { x: x + box.left, y: baseline - box.top, width: box.right - box.left, height: box.top - box.bottom };
}

function coord(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function caretPath(x: number, baseline: number): string {
  const { left, right, top, bottom, leg, apex } = ASCII_GLYPH.caret;
  const mid = coord(x + (left + right) / 2);
  const foot = coord(baseline - bottom);
  const peak = baseline - top;
  return `M${coord(x + left)} ${foot}L${mid} ${coord(peak)}L${coord(x + right)} ${foot}`
    + `L${coord(x + right - leg)} ${foot}L${mid} ${coord(peak + apex)}L${coord(x + left + leg)} ${foot}Z`;
}

function glyphPath(ch: string, x: number, baseline: number): string {
  if (ch === '^') return caretPath(x, baseline);
  const rect = glyphRect(ch, x, baseline);
  if (rect === null) return '';
  return `M${coord(rect.x)} ${coord(rect.y)}h${coord(rect.width)}v${coord(rect.height)}h${coord(-rect.width)}Z`;
}

export function asciiPath(art: string, width: number, height: number): string {
  const lines = art.split('\n');
  const origin = asciiOrigin(width, height, lines[0]?.length ?? 0, lines.length);
  const parts: string[] = [];
  lines.forEach((line, row) => {
    const baseline = origin.y + row * ASCII.lineHeight + ASCII_GLYPH.baseline;
    for (let col = 0; col < line.length; col += 1) {
      const d = glyphPath(line[col] ?? ' ', origin.x + col * ASCII_GLYPH.pitch, baseline);
      if (d.length > 0) parts.push(d);
    }
  });
  return parts.join('');
}

export function asciiGrid(width: number, height: number): { cols: number; rows: number } {
  const effectiveWidth = Math.min(width, ASCII.maxWidth);
  return {
    cols: Math.max(1, Math.floor(effectiveWidth / ASCII.cellWidth)),
    rows: Math.ceil(height / ASCII.lineHeight) + 2,
  };
}

export function tornadoField(x: number, y: number, cols: number, rows: number, t: number): number {
  const centerX = cols * 0.5 + Math.sin(t * 0.3) * cols * 0.1;
  const centerY = rows * 0.5 + Math.cos(t * 0.2) * rows * 0.1;
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const vortex = Math.sin((angle + distance * 0.02 - t * 0.6) * 3) * Math.exp(-distance * 0.003);
  const eye = distance < 30 ? -2 : 0;
  const debris =
    Math.sin((angle + distance * 0.03 - t * 0.4) * 8) * Math.exp(-distance * 0.004) * Math.sin(y * 0.1 - t * 0.6);
  const turbulence = Math.sin(x * 0.2 + y * 0.15 - t * 1.2) * Math.exp(-distance * 0.002) * 0.5;
  const rotation = Math.sin(angle * 5 + t * 0.9) * (1 - distance * 0.001);
  return eye + vortex * 1.5 + debris + turbulence + rotation * 0.8;
}

export function asciiFrame(cols: number, rows: number, time: number): string {
  const t = time * 0.5;
  const lines: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    let line = '';
    for (let x = 0; x < cols; x += 1) {
      const i = Math.floor((tornadoField(x, y, cols, rows, t) + 1) * 2);
      line += ASCII.chars[Math.max(0, Math.min(i, 4))] ?? ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
