import type { ComposerImageFile } from './pastedImages.types';

export function usePastedImages(onImages: (files: ComposerImageFile[]) => void): void {
  void onImages;
}

export function usePastedPicture(enabled: boolean, onImage: (file: ComposerImageFile) => void): void {
  void enabled;
  void onImage;
}
