import type { ThemeColor } from '@stage-labs/kit/chatkit';

export const DANGER_COLOR: ThemeColor = { dark: '#eb4c5b', light: '#eb4c5b' };

export const SUCCESS_COLOR: ThemeColor = { dark: '#57b375', light: '#57b375' };

export function changeColor(change: string): ThemeColor {
  return change.trim().startsWith('-') ? DANGER_COLOR : SUCCESS_COLOR;
}
