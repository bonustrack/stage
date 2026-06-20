
export type Scheme = 'light' | 'dark';

export interface ThemeSeed {
  grayscale: string;
  accent: string;
  surface: {
    background: string;
    foreground: string;
  };
}

export interface DerivedPalette {
  bg: string; border: string; text: string; sub: string; link: string;
  primary: string; danger: string; success: string;
  inputBg: string; toolbarBg: string;
}

export const DANGER_FIXED = '#eb4c5b';
export const SUCCESS_FIXED = '#57b375';


function clamp255(n: number): number { return n < 0 ? 0 : n > 255 ? 255 : Math.round(n); }

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number): string => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a); const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}


export const DEFAULT_SEED: Record<Scheme, ThemeSeed> = {
  dark: {
    grayscale: '#282a2d',
    accent: '#ffffff',
    surface: { background: '#0e0f10', foreground: '#9f9fa3' },
  },
  light: {
    grayscale: '#e4e4e5',
    accent: '#000000',
    surface: { background: '#ffffff', foreground: '#57606a' },
  },
};


const BORDER_RATIO = 1;

const INPUT_BG_RATIO: Record<Scheme, number> = {
  dark: 0.5,
  light: 0.5,
};

const SUB_RATIO: Record<Scheme, number> = {
  dark: 0.5,
  light: 0.5,
};


const LEGACY: Record<Scheme, DerivedPalette> = {
  dark: {
    bg: '#0e0f10', border: '#282a2d', text: '#9f9fa3', sub: '#7a7a7e',
    link: '#ffffff', primary: '#ffffff', danger: DANGER_FIXED, success: SUCCESS_FIXED,
    inputBg: '#1c1d1f', toolbarBg: '#0e0f10',
  },
  light: {
    bg: '#ffffff', border: '#e4e4e5', text: '#57606a', sub: '#8a929d',
    link: '#000000', primary: '#000000', danger: DANGER_FIXED, success: SUCCESS_FIXED,
    inputBg: '#f2f2f3', toolbarBg: '#ffffff',
  },
};

function seedEquals(a: ThemeSeed, b: ThemeSeed): boolean {
  return a.grayscale.toLowerCase() === b.grayscale.toLowerCase()
    && a.accent.toLowerCase() === b.accent.toLowerCase()
    && a.surface.background.toLowerCase() === b.surface.background.toLowerCase()
    && a.surface.foreground.toLowerCase() === b.surface.foreground.toLowerCase();
}

export function derivePalette(seed: ThemeSeed, scheme: Scheme): DerivedPalette {
  if (seedEquals(seed, DEFAULT_SEED[scheme])) return { ...LEGACY[scheme] };

  const bg = seed.surface.background;
  const text = seed.surface.foreground;
  const border = mix(bg, seed.grayscale, BORDER_RATIO);
  const inputBg = mix(bg, seed.grayscale, INPUT_BG_RATIO[scheme]);
  const sub = mix(text, seed.grayscale, SUB_RATIO[scheme]);
  return {
    bg,
    border,
    text,
    sub,
    link: seed.accent,
    primary: seed.accent,
    danger: DANGER_FIXED,
    success: SUCCESS_FIXED,
    inputBg,
    toolbarBg: bg,
  };
}

export function assertDefaultLossless(): void {
  for (const scheme of ['dark', 'light'] as const) {
    const got = derivePalette(DEFAULT_SEED[scheme], scheme);
    const want = LEGACY[scheme];
    for (const k of Object.keys(want) as (keyof DerivedPalette)[]) {
      if (got[k].toLowerCase() !== want[k].toLowerCase()) {
        throw new Error(`theme-derive default not lossless: ${scheme}.${k} ${got[k]} != ${want[k]}`);
      }
    }
  }
}
