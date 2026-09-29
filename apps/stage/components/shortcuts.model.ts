import { isEditableTarget } from './bubble/imageGallery.model';

export type Shortcut = '/' | 'c';

export interface ShortcutKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
}

export interface ShortcutTarget {
  tagName: string | null;
  contentEditable: boolean;
}

const SHORTCUT_KEYS: ReadonlyMap<string, Shortcut> = new Map<string, Shortcut>([['/', '/'], ['c', 'c'], ['C', 'c']]);

export function shortcutOf(event: ShortcutKeyEvent, target: ShortcutTarget | null, dialogOpen: boolean): Shortcut | null {
  if (dialogOpen || event.defaultPrevented || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (target !== null && isEditableTarget(target.tagName, target.contentEditable)) return null;
  return SHORTCUT_KEYS.get(event.key) ?? null;
}

export function shortcutKey(shortcut: Shortcut): string {
  return shortcut.toUpperCase();
}
