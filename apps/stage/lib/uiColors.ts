import { semanticColors, type ThemeColor } from '@stage-labs/kit/tokens';

export function changeColor(change: string): ThemeColor {
  return change.trim().startsWith('-') ? semanticColors.dangerColor : semanticColors.successColor;
}

export const HIGHLIGHT_BG: ThemeColor = { dark: '#fde047', light: '#FFF200' };

export const MESSAGE_LINK_COLOR: ThemeColor = { dark: '#4493f8', light: '#0969da' };

export const SEEK_THUMB: ThemeColor = { dark: '#f4f4f5', light: '#ffffff' };

export const ON_PRIMARY_COLOR: ThemeColor = { dark: '#000000', light: '#ffffff' };

export const MEMBER_OWNER_FG: ThemeColor = { dark: '#2dd4bf', light: '#0d9488' };

export const MEMBER_OWNER_BG: ThemeColor = {
  dark: 'rgba(45,212,191,0.18)',
  light: 'rgba(13,148,136,0.12)',
};

