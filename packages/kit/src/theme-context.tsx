
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { semanticPalette } from './tokens';

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
  return { palette: defaultPalette('light'), scheme: 'light' };
}

export function useKitPalette(): KitPalette {
  return useKitThemeValue().palette;
}

export function useKitScheme(): 'light' | 'dark' {
  return useKitThemeValue().scheme;
}
