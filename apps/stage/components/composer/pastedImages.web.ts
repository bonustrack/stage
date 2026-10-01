import { useEffect, useRef } from 'react';
import type { ComposerImageFile } from './pastedImages.types';
import { carriesPlainText, imageItemIndexes, pastedImageName, takesImagePaste, takesPicturePaste } from './pastedImages.model';

let openPictureTargets = 0;
const imageTargets: { owner: symbol; zoneId: string | undefined }[] = [];

function shown(zoneId: string | undefined): boolean {
  if (zoneId === undefined) return true;
  const zone = document.getElementById(zoneId);
  return zone !== null && zone.getClientRects().length > 0;
}

function pasteOwner(): symbol | undefined {
  return imageTargets.findLast(target => shown(target.zoneId))?.owner;
}

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

export function usePastedImages(onImages: (files: ComposerImageFile[]) => void, zoneId?: string): void {
  const handler = useRef(onImages);
  handler.current = onImages;
  useEffect(() => {
    const owner = Symbol('composer');
    imageTargets.push({ owner, zoneId });
    const onPaste = (event: ClipboardEvent): void => {
      if (openPictureTargets > 0 || pasteOwner() !== owner) return;
      const { tag, editable } = pasteTarget(event);
      if (!takesImagePaste(tag, editable)) return;
      const files = imagesFrom(clipboardItems(event), Infinity);
      if (files.length === 0) return;
      event.preventDefault();
      handler.current(files);
    };
    document.addEventListener('paste', onPaste);
    return (): void => {
      imageTargets.splice(imageTargets.findIndex(target => target.owner === owner), 1);
      document.removeEventListener('paste', onPaste);
    };
  }, [zoneId]);
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
