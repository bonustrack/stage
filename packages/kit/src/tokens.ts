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
} as const;

/** Resolve all 7 canonical tokens for an effective scheme. */
export function semanticPalette(scheme: 'light' | 'dark'): {
  bgColor: string; borderColor: string; textColor: string;
  linkColor: string; primaryColor: string;
  dangerColor: string; successColor: string;
} {
  return {
    bgColor: semanticColors.bgColor[scheme],
    borderColor: semanticColors.borderColor[scheme],
    textColor: semanticColors.textColor[scheme],
    linkColor: semanticColors.linkColor[scheme],
    primaryColor: semanticColors.primaryColor[scheme],
    dangerColor: semanticColors.dangerColor[scheme],
    successColor: semanticColors.successColor[scheme],
  };
}

/** Numeric design tokens (non-color). `radius` is the corner radius (px) applied
 *  to every non-circular button across the app. Default 999 = fully-rounded
 *  (the original pill look); editable + persisted via the app's radiusOverride
 *  store and applied through the kit Button's `setDefaultButtonRadius`. */
export const RADIUS_DEFAULT = 999;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 999;

/** Font families used across both shells (Calibre is bundled in both apps). */
export const fontFamily = {
  sans: ['Calibre-Medium', 'system-ui', 'sans-serif'],
  head: ['Calibre-Semibold', 'system-ui', 'sans-serif'],
  mono: ['Menlo', 'ui-monospace', 'monospace'],
} as const;
