import { loadAsync, useFonts } from 'expo-font';
import { KIT_FONTS } from '@stage-labs/kit/react-native/fonts';
import type { FontChoice, FontPreviewScope } from './fontChoice';
import { reported } from './errorPolicy';

export function bootKitFonts(): void {
  void loadAsync(KIT_FONTS).catch(reported('boot.fonts'));
}

export const useKitFontsLoaded = (): boolean => useFonts(KIT_FONTS)[0];

export const useFontPreviews = (): ((choice: FontChoice) => FontPreviewScope) | null => null;
