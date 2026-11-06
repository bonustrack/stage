import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { kitPalette, schemeRolesOf, type KitPalette, type SchemePalette, type Scheme } from '../tokens';
import { loadKitFonts } from './fonts.load';

export type { KitPalette } from '../tokens';

loadKitFonts();

export interface KitThemeValue {
  palette: KitPalette;
  scheme: 'light' | 'dark';
}

const KitThemeContext = createContext<KitThemeValue | null>(null);

export interface KitThemeProviderProps {
  value: KitPalette;
  scheme: 'light' | 'dark';
  children: ReactNode;
}

export function KitThemeProvider({ value, scheme, children }: KitThemeProviderProps): React.ReactElement {
  return createElement(KitThemeContext.Provider, { value: { palette: value, scheme } }, children);
}

function useKitThemeValue(): KitThemeValue {
  const ctx = useContext(KitThemeContext);
  if (ctx) return ctx;
  return { palette: kitPalette('light'), scheme: 'light' };
}

export function useKitPalette(): KitPalette {
  return useKitThemeValue().palette;
}

export function useKitScheme(): 'light' | 'dark' {
  return useKitThemeValue().scheme;
}

export type KitPaletteMode = 'provider' | 'matching' | 'static';

export interface KitColors {
  scheme: Scheme;
  dark: boolean;
  palette: KitPalette;
  roles: SchemePalette;
}

function paletteFor(mode: KitPaletteMode, dark: boolean | undefined, scheme: Scheme, provided: KitThemeValue): KitPalette {
  if (mode === 'static') return kitPalette(scheme);
  if (mode === 'provider') return dark === undefined ? provided.palette : kitPalette(scheme);
  return scheme === provided.scheme ? provided.palette : kitPalette(scheme);
}

export function useKitColors(dark: boolean | undefined, mode: KitPaletteMode): KitColors {
  const provided = useKitThemeValue();
  return useMemo(() => {
    const scheme: Scheme = dark === undefined ? provided.scheme : dark ? 'dark' : 'light';
    const palette = paletteFor(mode, dark, scheme, { palette: provided.palette, scheme: provided.scheme });
    return { scheme, dark: scheme === 'dark', palette, roles: schemeRolesOf(palette) };
  }, [mode, dark, provided.palette, provided.scheme]);
}

export function useKitPaletteFor(dark: boolean | undefined): KitPalette {
  return useKitColors(dark, 'provider').palette;
}
