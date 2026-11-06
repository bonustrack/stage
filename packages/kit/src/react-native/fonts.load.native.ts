import { loadAsync } from 'expo-font';
import { KIT_FONTS, type KitFontFace } from './fonts.faces';

let started = false;

export function loadKitFonts(): void {
  if (started) return;
  started = true;
  loadAsync(KIT_FONTS).catch((error: unknown) => {
    console.warn('Kit could not load its fonts', error);
  });
}

export function setKitFontFaces(faces: readonly KitFontFace[]): void {
  if (faces.length > 0) loadKitFonts();
}
