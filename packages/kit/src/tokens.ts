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
} as const;

/** Font families used across both shells (Calibre is bundled in both apps). */
export const fontFamily = {
  sans: ['Calibre-Medium', 'system-ui', 'sans-serif'],
  head: ['Calibre-Semibold', 'system-ui', 'sans-serif'],
  mono: ['Menlo', 'ui-monospace', 'monospace'],
} as const;
