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
