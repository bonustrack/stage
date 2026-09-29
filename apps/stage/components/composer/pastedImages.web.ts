import { useEffect, useRef } from 'react';
import type { ComposerImageFile } from './pastedImages.types';
import { carriesPlainText, imageItemIndexes, pastedImageName, takesImagePaste, takesPicturePaste } from './pastedImages.model';

let openPictureTargets = 0;
const imageTargets: symbol[] = [];

function clipboardItems(event: ClipboardEvent): DataTransferItem[] {
  return Array.from(event.clipboardData?.items ?? []);
}

function imagesFrom(items: DataTransferItem[], limit: number): ComposerImageFile[] {
  return imageItemIndexes(items).slice(0, limit).flatMap((i, n) => {
    const file = items[i]?.getAsFile();
    if (!file) return [];
    return [{ uri: URL.createObjectURL(file), mime: file.type, name: file.name || pastedImageName(file.type, n) }];
  });
}

function pasteTarget(event: ClipboardEvent): { tag: string | null; editable: boolean } {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const editable = target !== null && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
  return { tag: target?.tagName ?? null, editable };
}

export function usePastedImages(onImages: (files: ComposerImageFile[]) => void): void {
  const handler = useRef(onImages);
  handler.current = onImages;
  useEffect(() => {
    const owner = Symbol('composer');
    imageTargets.push(owner);
    const onPaste = (event: ClipboardEvent): void => {
      if (openPictureTargets > 0 || imageTargets[imageTargets.length - 1] !== owner) return;
      const { tag, editable } = pasteTarget(event);
      if (!takesImagePaste(tag, editable)) return;
      const files = imagesFrom(clipboardItems(event), Infinity);
      if (files.length === 0) return;
      event.preventDefault();
      handler.current(files);
    };
    document.addEventListener('paste', onPaste);
    return (): void => {
      imageTargets.splice(imageTargets.indexOf(owner), 1);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}

export function usePastedPicture(enabled: boolean, onImage: (file: ComposerImageFile) => void): void {
  const handler = useRef(onImage);
  handler.current = onImage;
  useEffect(() => {
    openPictureTargets += 1;
    const onPaste = (event: ClipboardEvent): void => {
      const items = clipboardItems(event);
      if (!takesPicturePaste(pasteTarget(event).editable, carriesPlainText(items))) return;
      const file = imagesFrom(items, 1)[0];
      if (file === undefined) return;
      event.preventDefault();
      handler.current(file);
    };
    if (enabled) document.addEventListener('paste', onPaste);
    return (): void => {
      openPictureTargets -= 1;
      document.removeEventListener('paste', onPaste);
    };
  }, [enabled]);
}
