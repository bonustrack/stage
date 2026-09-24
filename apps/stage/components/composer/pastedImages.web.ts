import { useEffect, useRef } from 'react';
import type { ComposerImageFile } from './pastedImages.types';
import { imageItemIndexes, pastedImageName, takesImagePaste } from './pastedImages.model';

function imagesFrom(event: ClipboardEvent): ComposerImageFile[] {
  const items = Array.from(event.clipboardData?.items ?? []);
  return imageItemIndexes(items).flatMap((i, n) => {
    const file = items[i]?.getAsFile();
    if (!file) return [];
    return [{ uri: URL.createObjectURL(file), mime: file.type, name: file.name || pastedImageName(file.type, n) }];
  });
}

export function usePastedImages(onImages: (files: ComposerImageFile[]) => void): void {
  const handler = useRef(onImages);
  handler.current = onImages;
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editable = target !== null && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!takesImagePaste(target?.tagName ?? null, editable)) return;
      const files = imagesFrom(event);
      if (files.length === 0) return;
      event.preventDefault();
      handler.current(files);
    };
    document.addEventListener('paste', onPaste);
    return (): void => { document.removeEventListener('paste', onPaste); };
  }, []);
}
