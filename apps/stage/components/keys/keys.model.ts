export type Shortcut = '/' | 'c';

export type Arrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

type VerticalArrow = 'ArrowUp' | 'ArrowDown';

export interface KeyEventLike {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
}

export interface KeyTarget {
  tagName: string | null;
  contentEditable: boolean;
  text: string;
}

export interface MarkedNode {
  dataSet: Readonly<Record<string, string>>;
}

const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableTarget(tagName: string | null, contentEditable: boolean): boolean {
  return contentEditable || (tagName !== null && EDITABLE_TAGS.has(tagName));
}

const editable = (target: KeyTarget | null): boolean => target !== null && isEditableTarget(target.tagName, target.contentEditable);

const SHORTCUT_KEYS: ReadonlyMap<string, Shortcut> = new Map<string, Shortcut>([
  ['/', '/'],
  ['c', 'c'],
  ['C', 'c'],
]);

export function shortcutOf(event: Omit<KeyEventLike, 'shiftKey'>, target: KeyTarget | null, dialogOpen: boolean): Shortcut | null {
  if (dialogOpen || event.defaultPrevented || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (editable(target)) return null;
  return SHORTCUT_KEYS.get(event.key) ?? null;
}

export function shortcutKey(shortcut: Shortcut): string {
  return shortcut.toUpperCase();
}

export const ALL_ARROWS: ReadonlySet<Arrow> = new Set<Arrow>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export const VERTICAL_ARROWS: ReadonlySet<VerticalArrow> = new Set<VerticalArrow>(['ArrowUp', 'ArrowDown']);

function isOneOf<A extends Arrow>(arrows: ReadonlySet<A>, key: string): key is A {
  const known: ReadonlySet<string> = arrows;
  return known.has(key);
}

export function arrowKeyOf<A extends Arrow>(
  event: Omit<KeyEventLike, 'isComposing'>,
  target: KeyTarget | null,
  arrows: ReadonlySet<A>,
): A | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const typing = editable(target) && target?.text !== '';
  return !typing && isOneOf(arrows, event.key) ? event.key : null;
}

export function stepRow<T extends { convId: string }>(rows: readonly T[], convId: string | null, arrow: VerticalArrow): T | null {
  const index = rows.findIndex((row) => row.convId === convId);
  return index === -1 ? null : (rows[index + (arrow === 'ArrowUp' ? -1 : 1)] ?? null);
}

export function revealScrollDelta(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  if (top < viewTop) return top - viewTop;
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop);
  return 0;
}
