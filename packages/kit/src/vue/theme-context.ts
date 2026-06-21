import { inject, provide, type InjectionKey } from 'vue';
import { semanticPalette } from '../tokens';

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

export function defaultKitPalette(scheme: 'light' | 'dark'): KitPalette {
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

export const KitThemeKey: InjectionKey<KitThemeValue> = Symbol('KitTheme');

export interface ProvideKitThemeOptions {
  palette?: KitPalette;
  scheme: 'light' | 'dark';
}

export function provideKitTheme(options: ProvideKitThemeOptions): void {
  const palette = options.palette ?? defaultKitPalette(options.scheme);
  provide(KitThemeKey, { palette, scheme: options.scheme });
}

function useKitThemeValue(): KitThemeValue {
  const ctx = inject(KitThemeKey, null);
  if (ctx) return ctx;
  return { palette: defaultKitPalette('light'), scheme: 'light' };
}

export function useKitPalette(): KitPalette {
  return useKitThemeValue().palette;
}

export function useKitScheme(): 'light' | 'dark' {
  return useKitThemeValue().scheme;
}
