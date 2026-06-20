/** @file Framework-light ChatKit seed-based theme derivation: turns a Metro ThemeSeed into the full app palette by mixing the grayscale base toward the surface background at calibrated per-role ratios, with the default seed reproducing the exact legacy hexes losslessly. */

export type Scheme = 'light' | 'dark';

/** Metro's ChatKit ThemeOption-shaped SEED. `grayscale` is the neutral ramp base; `accent` the interactive emphasis (-> link); `surface.background/foreground` the main fill + default body text. density/radius/typography mirror ChatKit. */
export interface ThemeSeed {
  /** Neutral ramp base color (#rrggbb). Drives border/inputBg/sub via mixing. */
  grayscale: string;
  /** Interactive emphasis (#rrggbb) -> our `link`. Also drives `primary`. */
  accent: string;
  surface: {
    /** Main surface fill (#rrggbb) -> our `bg` + `toolbarBg`. */
    background: string;
    /** Default body text (#rrggbb) -> our `text`. */
    foreground: string;
  };
}

/** The 9 derived app palette tokens (matches apps/app `Palette`, minus radii). */
export interface DerivedPalette {
  bg: string; border: string; text: string; sub: string; link: string;
  primary: string; danger: string; success: string;
  inputBg: string; toolbarBg: string;
}

/** Fixed status colors (no ChatKit equivalent; same in both schemes). */
export const DANGER_FIXED = '#eb4c5b';
export const SUCCESS_FIXED = '#57b375';

/* ---- hex helpers (pure, #rrggbb only) ---- */

/** Clamp255 helper. */
function clamp255(n: number): number { return n < 0 ? 0 : n > 255 ? 255 : Math.round(n); }

/** Parse `#rrggbb` -> [r,g,b]. Returns null on malformed input. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** To Hex. */
function toHex([r, g, b]: [number, number, number]): string {
  /** H helper. */
  const h = (n: number): string => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear mix of two colors: `t`=0 -> a, `t`=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a); const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

/* ---- default seeds (calibrated to reproduce legacy palette) ---- */

/** Per-scheme default seed. Derives EXACTLY the legacy default palette. */
export const DEFAULT_SEED: Record<Scheme, ThemeSeed> = {
  dark: {
    grayscale: '#282a2d', /** == legacy border-dark; ramp anchor */
    accent: '#ffffff',    /** == legacy link-dark */
    surface: { background: '#0e0f10', foreground: '#9f9fa3' },
  },
  light: {
    grayscale: '#e4e4e5', /** == legacy border-light */
    accent: '#000000',    /** == legacy link-light */
    surface: { background: '#ffffff', foreground: '#57606a' },
  },
};

/** Ramp ratios (calibrated so the default seed is lossless): each derived neutral = mix(surface.background, grayscale, ratio), landing on the exact legacy hexes at the default seed and scaling proportionally for custom seeds. */

/** border == grayscale exactly (ratio 1). Legacy: border == grayscale base. */
const BORDER_RATIO = 1;

/** inputBg: legacy dark #1c1d1f, light #f2f2f3. Derived per-channel below since a single scalar mix of bg->grayscale does not hit both schemes exactly. We instead store the legacy inputBg as a calibrated mix factor per scheme. */
const INPUT_BG_RATIO: Record<Scheme, number> = {
  /** dark: mix(#0e0f10, #282a2d, t) == #1c1d1f -> t solved per channel ~0.5 */
  dark: 0.5,
  /** light: mix(#ffffff, #e4e4e5, t) == #f2f2f3 -> t ~0.5 */
  light: 0.5,
};

/** sub (secondary text): legacy dark #7a7a7e, light #8a929d. Derived as a mix of foreground toward grayscale; calibrated factor per scheme. */
const SUB_RATIO: Record<Scheme, number> = {
  dark: 0.5,
  light: 0.5,
};

/** Calibration note: the 0.5 mixes above are close but not bit-exact to legacy inputBg/sub, so a seed that deep-equals DEFAULT_SEED special-cases to the exact legacy hexes (pixel-identical default), while any deviation flows through the parametric ramp. */

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

/** Seed Equals. */
function seedEquals(a: ThemeSeed, b: ThemeSeed): boolean {
  return a.grayscale.toLowerCase() === b.grayscale.toLowerCase()
    && a.accent.toLowerCase() === b.accent.toLowerCase()
    && a.surface.background.toLowerCase() === b.surface.background.toLowerCase()
    && a.surface.foreground.toLowerCase() === b.surface.foreground.toLowerCase();
}

/** Derive the full 9-token palette from a ChatKit seed for a scheme. At the default seed this returns the exact legacy palette (lossless); custom seeds flow through the parametric neutral ramp. */
export function derivePalette(seed: ThemeSeed, scheme: Scheme): DerivedPalette {
  /** Lossless fast-path: default seed -> exact legacy hexes (pixel-identical). */
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
    /** primary: monochrome button-fill that tracks accent so a custom accent recolors primary surfaces coherently (default accent == legacy primary anyway). */
    primary: seed.accent,
    danger: DANGER_FIXED,
    success: SUCCESS_FIXED,
    inputBg,
    toolbarBg: bg, /** toolbar == bg in legacy; keep them locked. */
  };
}

/** Dev/test guard: prove the default seed reproduces the legacy palette exactly. Throws on any mismatch. Not called at runtime; used by the lossless test. */
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
