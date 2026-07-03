import type { ThemeColor } from '@stage-labs/kit/kit';
import { colors } from '@stage-labs/kit/tokens';

export const DANGER_COLOR: ThemeColor = { dark: '#eb4c5b', light: '#eb4c5b' };

export const SUCCESS_COLOR: ThemeColor = { dark: '#57b375', light: '#57b375' };

export function changeColor(change: string): ThemeColor {
  return change.trim().startsWith('-') ? DANGER_COLOR : SUCCESS_COLOR;
}

export const HIGHLIGHT_BG: ThemeColor = { dark: '#fde047', light: '#FFF200' };

export const VOICE_ACCENT: ThemeColor = { dark: '#3b9bff', light: '#0a7cff' };

export const VOICE_ON_ACCENT: ThemeColor = { dark: '#ffffff', light: '#ffffff' };

export const ON_PRIMARY_COLOR: ThemeColor = { dark: '#000000', light: '#ffffff' };

export const MEMBER_OWNER_FG: ThemeColor = { dark: '#2dd4bf', light: '#0d9488' };

export const MEMBER_OWNER_BG: ThemeColor = {
  dark: 'rgba(45,212,191,0.18)',
  light: 'rgba(13,148,136,0.12)',
};

export const SURFACE_COLOR: ThemeColor = {
  dark: colors['surface-dark'],
  light: colors['surface-light'],
};

export const BORDER_COLOR: ThemeColor = {
  dark: colors['border-dark'],
  light: colors['border-light'],
};

export const FG_COLOR: ThemeColor = { dark: colors['fg-dark'], light: colors['fg-light'] };

export const HEAD_COLOR: ThemeColor = { dark: colors['head-dark'], light: colors['head-light'] };

export const BG_COLOR: ThemeColor = { dark: colors['bg-dark'], light: colors['bg-light'] };
