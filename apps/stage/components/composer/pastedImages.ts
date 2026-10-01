import type { ComposerImageFile } from './pastedImages.types';

export function usePastedImages(onImages: (files: ComposerImageFile[], keepFocus: boolean) => void, zoneId?: string): void {
  void onImages;
  void zoneId;
}

export function usePastedPicture(enabled: boolean, onImage: (file: ComposerImageFile) => void): void {
  void enabled;
  void onImage;
}
