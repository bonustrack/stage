import type { ComponentType } from 'react';
import type { CentralIconBaseProps } from '@central-icons-react-native/round-outlined-radius-1-stroke-2';

export type CentralIcon = ComponentType<CentralIconBaseProps>;

export type IconStyle = 'line' | 'solid';

export function iconStroke(color: string | undefined, dark: boolean | undefined): string {
  return color ?? (dark === undefined ? 'currentColor' : dark ? '#ffffff' : '#000000');
}
