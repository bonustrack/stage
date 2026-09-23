
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { kitPalette, type KitPalette } from '../tokens';

export type { KitPalette } from '../tokens';

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
