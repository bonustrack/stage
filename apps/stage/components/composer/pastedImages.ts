import type { ComposerImageFile } from './pastedImages.types';

export function usePastedImages(onImages: (files: ComposerImageFile[]) => void): void {
  void onImages;
}
