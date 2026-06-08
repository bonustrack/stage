/** Metro design tokens — the single source of truth for the colour palette
 *  shared by the Vue web client (apps/ui, via tailwind.config.ts) and the
 *  React Native app (apps/app, inline StyleSheet colours).
 *
 *  Historically these hex values were duplicated: apps/ui/tailwind.config.ts
 *  defined a `metro.*` colour scale and apps/app/**.tsx hard-coded the same
 *  literals. This module centralises them so the two shells stay in lock-step.
 *
 *  Pure data — no framework deps. */

/** The full `metro` colour scale. Keys match apps/ui's Tailwind `colors.metro.*`.
 *  Each light/dark pair is split so a consumer can pick by effective scheme. */
export const colors = {
  /** Backgrounds */
  'bg-dark': '#0e0f10',
  'bg-light': '#ffffff',
  /** Inputs/surfaces share the border colour per the palette spec. */
  'surface-dark': '#282a2d',
  'surface-light': '#e4e4e5',
  /** Input/dropdown fill: a subtle surface distinct from bg. */
  'input-bg-dark': '#1c1d1f',
  'input-bg-light': '#f2f2f3',
  /** Toolbar/nav fill: solid bg behind the gradient/border navs. */
  'toolbar-bg-dark': '#0e0f10',
  'toolbar-bg-light': '#ffffff',
  'hover-dark': '#1c1d1f',
  'hover-light': '#f2f2f3',
  /** Body / default text */
  'fg-dark': '#9f9fa3',
  'fg-light': '#57606a',
  'sub-dark': '#7a7a7e',
  'sub-light': '#8a929d',
  /** Strong text: headings, links, primary buttons */
  'head-dark': '#ffffff',
  'head-light': '#000000',
  /** Borders */
  'border-dark': '#282a2d',
  'border-light': '#e4e4e5',
  /** Accents */
  accent: '#ffffff',
  'accent-hover': '#cccccc',
  ok: '#83c989',
  warn: '#c0a06e',
  err: '#d96868',
  /** Canonical semantic danger/success — same value in both schemes. */
  'danger-dark': '#eb4c5b',
  'danger-light': '#eb4c5b',
  'success-dark': '#57b375',
  'success-light': '#57b375',
  /** Brand primary — monochrome. White on dark, black on light so interactive
   *  text/primary surfaces read as high-contrast rather than a brand hue.
   *  Links reuse the same values. */
  'primary-dark': '#ffffff',
  'primary-light': '#000000',
  'link-dark': '#ffffff',
  'link-light': '#000000',
} as const;

/** The 7 canonical semantic color tokens — the single source of truth consumed
 *  by both shells via a scheme-aware lookup. Each maps to the palette values
 *  above so adopting a token never changes a rendered color. */
export const semanticColors = {
  bgColor: { dark: colors['bg-dark'], light: colors['bg-light'] },
  borderColor: { dark: colors['border-dark'], light: colors['border-light'] },
  /** Body text (fg). Strong/heading text stays on `head`. */
  textColor: { dark: colors['fg-dark'], light: colors['fg-light'] },
  linkColor: { dark: colors['link-dark'], light: colors['link-light'] },
  primaryColor: { dark: colors['primary-dark'], light: colors['primary-light'] },
  dangerColor: { dark: colors['danger-dark'], light: colors['danger-light'] },
  successColor: { dark: colors['success-dark'], light: colors['success-light'] },
  inputBgColor: { dark: colors['input-bg-dark'], light: colors['input-bg-light'] },
  toolbarBgColor: { dark: colors['toolbar-bg-dark'], light: colors['toolbar-bg-light'] },
} as const;

/** Resolve all 7 canonical tokens for an effective scheme. */
export function semanticPalette(scheme: 'light' | 'dark'): {
  bgColor: string; borderColor: string; textColor: string;
  linkColor: string; primaryColor: string;
  dangerColor: string; successColor: string;
  inputBgColor: string; toolbarBgColor: string;
} {
  return {
    bgColor: semanticColors.bgColor[scheme],
    borderColor: semanticColors.borderColor[scheme],
    textColor: semanticColors.textColor[scheme],
    linkColor: semanticColors.linkColor[scheme],
    primaryColor: semanticColors.primaryColor[scheme],
    dangerColor: semanticColors.dangerColor[scheme],
    successColor: semanticColors.successColor[scheme],
    inputBgColor: semanticColors.inputBgColor[scheme],
    toolbarBgColor: semanticColors.toolbarBgColor[scheme],
  };
}

/** Numeric design tokens (non-color), both editable + persisted via the app's
 *  radiusOverride store.
 *
 *  `button-border-radius` (BUTTON_RADIUS_DEFAULT) — corner radius (px) of every
 *  non-circular button across the app. Default 999 = fully-rounded (the original
 *  pill look); applied through the kit Button's `setDefaultButtonRadius`.
 *
 *  `border-radius` (BLOCK_RADIUS_DEFAULT) — corner radius (px) of every
 *  non-button container surface: inputs/text fields, cards, modals/sheets and
 *  general bordered/filled "blocks". Default 12 matches the prevailing container
 *  look (inputs 10–12, cards 14). */
export const RADIUS_DEFAULT = 999;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 999;
/** Alias for the button radius default (clearer name; same value as legacy RADIUS_DEFAULT). */
export const BUTTON_RADIUS_DEFAULT = 999;
/** Default corner radius for non-button container "blocks". */
export const BLOCK_RADIUS_DEFAULT = 12;

/** Font families used across both shells (Calibre is bundled in both apps). */
export const fontFamily = {
  sans: ['Calibre-Medium', 'system-ui', 'sans-serif'],
  head: ['Calibre-Semibold', 'system-ui', 'sans-serif'],
  mono: ['Menlo', 'ui-monospace', 'monospace'],
} as const;

/* ------------------------------------------------------------------------- *
 * ChatKit-shaped theme alignment (additive, non-breaking).
 *
 * The app-facing palette stays the short 7 keys (bg/text/link/...) consumed by
 * 60+ usePalette callers. This block adds a ChatKit ThemeOption-shaped view of
 * the SAME source-of-truth `semanticColors`, so naming aligns without a rename.
 *
 * KEY mapping gotcha (per CHATKIT_PLAN.md): ChatKit `color.accent.primary`
 * maps to OUR `linkColor` (brand emphasis), NOT our `primaryColor`. Our
 * `primaryColor` is the button-fill (white on dark / black on light), which
 * ChatKit has no direct equivalent for. Do not mix these up.
 * ------------------------------------------------------------------------- */

/** ChatKit `radius` option. Default 'pill'. */
export type RadiusName = 'pill' | 'round' | 'soft' | 'sharp';

/** Named-radius -> px map. `pill` reproduces today's BUTTON_RADIUS_DEFAULT and
 *  `soft` reproduces BLOCK_RADIUS_DEFAULT, so defaults are visually unchanged.
 *  The fine-grained px overrides (radiusOverride store) remain the lower layer. */
export const RADIUS_SCALE: Record<RadiusName, number> = {
  pill: 999,
  round: 16,
  soft: 12,
  sharp: 0,
} as const;

/** Default named radius (ChatKit default). Resolves to BUTTON_RADIUS_DEFAULT. */
export const RADIUS_NAME_DEFAULT: RadiusName = 'pill';

/** ChatKit `density` option. Default 'normal'. */
export type Density = 'compact' | 'normal' | 'spacious';

/** Per-density padding scale (px) for Button/Card/ListView. `normal` reproduces
 *  today's spacing so the default render is unchanged. */
export const DENSITY_SCALE: Record<Density, { paddingX: number; paddingY: number; gap: number }> = {
  compact: { paddingX: 10, paddingY: 6, gap: 6 },
  normal: { paddingX: 14, paddingY: 10, gap: 10 },
  spacious: { paddingX: 18, paddingY: 14, gap: 14 },
} as const;

/** Default density (ChatKit default). */
export const DENSITY_DEFAULT: Density = 'normal';

/** ChatKit `typography.baseSize`. Today's Text default is 15. */
export type BaseSize = 14 | 15 | 16 | 17 | 18;

/** Default base font size (matches today's Text default of 15). */
export const BASE_SIZE_DEFAULT: BaseSize = 15;

/** A ChatKit ThemeOption-shaped object derived from `semanticColors`. Returned
 *  by `kitTheme`. Naming mirrors `@openai/chatkit` ThemeOption so a future
 *  ChatKit-aligned consumer reads naturally; values come from our tokens. */
export interface KitTheme {
  colorScheme: 'light' | 'dark';
  color: {
    surface: { background: string; foreground: string };
    /** `accent` == our brand `link` (NOT our button-fill `primary`). */
    accent: { primary: string; level: 0 | 1 | 2 | 3 };
  };
  /** Status extensions with no ChatKit equivalent; kept as Metro additions. */
  status: { danger: string; success: string };
  border: string;
  radius: { name: RadiusName; px: number };
  density: { name: Density; paddingX: number; paddingY: number; gap: number };
  typography: { baseSize: BaseSize; fontFamily: string; fontFamilyMono: string };
}

/** Options for `kitTheme` (all optional; defaults reproduce today's values). */
export interface KitThemeOptions {
  radius?: RadiusName;
  density?: Density;
  baseSize?: BaseSize;
  /** Accent intensity 0-3 (hover/pressed). Cosmetic only in PR1. */
  accentLevel?: 0 | 1 | 2 | 3;
}

/** Derive a ChatKit-shaped theme object for an effective scheme from the same
 *  `semanticColors` source of truth. Pure data; no framework deps. With default
 *  options the result reproduces today's rendered values (non-breaking). */
export function kitTheme(scheme: 'light' | 'dark', opts: KitThemeOptions = {}): KitTheme {
  const radiusName = opts.radius ?? RADIUS_NAME_DEFAULT;
  const densityName = opts.density ?? DENSITY_DEFAULT;
  const density = DENSITY_SCALE[densityName];
  return {
    colorScheme: scheme,
    color: {
      surface: {
        background: semanticColors.bgColor[scheme],
        foreground: semanticColors.textColor[scheme],
      },
      accent: {
        primary: semanticColors.linkColor[scheme],
        level: opts.accentLevel ?? 0,
      },
    },
    status: {
      danger: semanticColors.dangerColor[scheme],
      success: semanticColors.successColor[scheme],
    },
    border: semanticColors.borderColor[scheme],
    radius: { name: radiusName, px: RADIUS_SCALE[radiusName] },
    density: { name: densityName, ...density },
    typography: {
      baseSize: opts.baseSize ?? BASE_SIZE_DEFAULT,
      fontFamily: fontFamily.sans[0],
      fontFamilyMono: fontFamily.mono[0],
    },
  };
}
