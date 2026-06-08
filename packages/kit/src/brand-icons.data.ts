/** Filled brand glyphs (social networks) - these are FILLED 24×24 paths, unlike
 *  the stroke-only Heroicons in heroicons.data.ts. Rendered with fill=currentColor
 *  and no stroke (see the BrandIcon renderer). Keep this set tiny: only the socials
 *  the profile screen links out to. Sourced from each brand's official mark,
 *  re-pathed to a 0 0 24 24 viewBox. */

export const BRAND_ICON_DATA = {
  // X (formerly Twitter) - official wordmark glyph.
  brandX: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  // GitHub - Octocat mark.
  brandGithub: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z',
  // Lens Protocol - flower mark (simplified filled glyph).
  brandLens: 'M12 4.5c1.38 0 2.5 1.12 2.5 2.5v.34a4 4 0 0 1 5.16 5.16l-.32.12a2.5 2.5 0 0 1-1.55 4.63c-.78 0-1.48-.36-1.94-.93A4.99 4.99 0 0 1 12 19.5a4.99 4.99 0 0 1-3.85-1.82c-.46.57-1.16.93-1.94.93a2.5 2.5 0 0 1-1.55-4.63l-.32-.12a4 4 0 0 1 5.16-5.16V7a2.5 2.5 0 0 1 2.5-2.5Zm0 6.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  // Farcaster - arch mark.
  brandFarcaster: 'M5 3h14v2.5h-1.7V21h-2.6v-5.2a2.7 2.7 0 0 0-5.4 0V21H6.7V5.5H5V3Zm-1.5 3.5h2L4.9 9.2V21H3V8.2l.5-1.7Zm15 0h2l.5 1.7V21h-1.9V9.2l-.6-2.7Z',
} as const;

export type BrandIconName = keyof typeof BRAND_ICON_DATA;

export function brandIconPath(name: BrandIconName): string {
  return BRAND_ICON_DATA[name];
}
