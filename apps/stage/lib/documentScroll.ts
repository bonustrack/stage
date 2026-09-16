import { Platform } from 'react-native';

export function documentScroll(): { x: number; y: number } {
  if (Platform.OS !== 'web') return { x: 0, y: 0 };
  return { x: window.scrollX, y: window.scrollY };
}
