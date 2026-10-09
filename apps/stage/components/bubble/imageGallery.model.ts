import { isSvgAttachment } from './fileCard.model';

export interface GalleryAttachment { kind: string; mime?: string; name?: string }

export interface GalleryItem<A extends GalleryAttachment> {
  key: string;
  entryId: string;
  index: number;
  att: A;
}

export interface GalleryKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function galleryKeyOf(entryId: string, index: number): string {
  return `${entryId}#${index}`;
}

export function galleryItemsOf<E extends { id: string }, A extends GalleryAttachment>(
  newestFirst: readonly E[],
  attachmentsOf: (entry: E) => readonly A[],
): GalleryItem<A>[] {
  const items: GalleryItem<A>[] = [];
  for (let i = newestFirst.length - 1; i >= 0; i--) {
    const entry = newestFirst[i];
    if (!entry) continue;
    attachmentsOf(entry).forEach((att, index) => {
      if (att.kind === 'image' && !isSvgAttachment(att)) items.push({ key: galleryKeyOf(entry.id, index), entryId: entry.id, index, att });
    });
  }
  return items;
}

export function galleryStep<T extends { key: string }>(items: readonly T[], currentKey: string, delta: number): T | null {
  const at = items.findIndex(item => item.key === currentKey);
  if (at < 0) return null;
  return items[at + delta] ?? null;
}

export function galleryKeyStep(event: GalleryKeyEvent, editableTarget: boolean): number {
  if (editableTarget || event.defaultPrevented) return 0;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  if (event.key === 'ArrowLeft') return -1;
  if (event.key === 'ArrowRight') return 1;
  return 0;
}

export function isEditableTarget(tagName: string | null, contentEditable: boolean): boolean {
  return contentEditable || (tagName !== null && EDITABLE_TAGS.has(tagName));
}
