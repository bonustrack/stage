/** @file KitThemeProvider / useKitPalette — the theme-native palette source letting Kit primitives resolve colours by semantic role, with a safe light-scheme fallback so primitives rendered outside the provider never crash. */

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { semanticPalette } from './tokens';

/** The resolved palette Kit primitives read by role. Mirrors apps/app's `Palette` (the usePalette() shape) plus `sub`, the secondary-text grey. */
export interface KitPalette {
  bg: string;
  border: string;
  text: string;
  sub: string;
  link: string;
  primary: string;
  danger: string;
  success: string;
  inputBg: string;
  toolbarBg: string;
}

export interface KitThemeValue {
  palette: KitPalette;
  scheme: 'light' | 'dark';
}

/** Build a KitPalette from the canonical tokens for a scheme. The provider-less fallback so a primitive never crashes outside a KitThemeProvider. */
function defaultPalette(scheme: 'light' | 'dark'): KitPalette {
  const s = semanticPalette(scheme);
  return {
    bg: s.bgColor,
    border: s.borderColor,
    text: s.textColor,
    sub: s.subColor,
    link: s.linkColor,
    primary: s.primaryColor,
    danger: s.dangerColor,
    success: s.successColor,
    inputBg: s.inputBgColor,
    toolbarBg: s.toolbarBgColor,
  };
}

const KitThemeContext = createContext<KitThemeValue | null>(null);

export interface KitThemeProviderProps {
  /** The resolved palette - pass apps/app's `usePalette()` result (it carries the user's live colour overrides). Its shape is a superset of KitPalette. */
  value: KitPalette;
  /** Effective scheme - pass `useEffectiveColorScheme()`. */
  scheme: 'light' | 'dark';
  children: ReactNode;
}

/** Mount once near the app root. Supplies the role-resolved palette + scheme to every Kit primitive below it. */
export function KitThemeProvider({ value, scheme, children }: KitThemeProviderProps): React.ReactElement {
  /** Use createElement (not JSX) so vue-tsc, which type-checks this shared kit file from apps/ui, never tries to resolve a JSX runtime ('vue/jsx-runtime'). */
  return createElement(KitThemeContext.Provider, { value: { palette: value, scheme } }, children);
}

/** Read the active Kit palette + scheme. Outside a provider it falls back to the canonical light-scheme palette so a primitive never crashes (the app always mounts the provider, so this only guards storybook/test/edge renders). */
function useKitThemeValue(): KitThemeValue {
  const ctx = useContext(KitThemeContext);
  if (ctx) return ctx;
  return { palette: defaultPalette('light'), scheme: 'light' };
}

/** Read the active Kit palette (role-resolved colours). */
export function useKitPalette(): KitPalette {
  return useKitThemeValue().palette;
}

/** Read the effective scheme (replaces the dropped `dark` prop on primitives). */
export function useKitScheme(): 'light' | 'dark' {
  return useKitThemeValue().scheme;
}
