import { loadAsync } from 'expo-font';
import { KIT_FONTS } from './fonts';

let started = false;

export function loadKitFonts(): void {
  if (started) return;
  started = true;
  loadAsync(KIT_FONTS).catch((error: unknown) => {
    console.warn('Kit could not load its fonts', error);
  });
}
