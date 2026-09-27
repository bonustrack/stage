import { isEditableTarget } from './bubble/imageGallery.model';

export type Arrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export type VerticalArrow = 'ArrowUp' | 'ArrowDown';

export interface ArrowKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

export interface ArrowKeyTarget {
  tagName: string | null;
  contentEditable: boolean;
  text: string;
}

export interface MarkedNode {
  dataSet: Readonly<Record<string, string>>;
}

export const ALL_ARROWS: ReadonlySet<Arrow> = new Set<Arrow>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export const VERTICAL_ARROWS: ReadonlySet<VerticalArrow> = new Set<VerticalArrow>(['ArrowUp', 'ArrowDown']);

function isOneOf<A extends Arrow>(arrows: ReadonlySet<A>, key: string): key is A {
  const known: ReadonlySet<string> = arrows;
  return known.has(key);
}

export function arrowKeyOf<A extends Arrow>(
  event: ArrowKeyEvent, target: ArrowKeyTarget | null, arrows: ReadonlySet<A>,
): A | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const typing = target !== null && isEditableTarget(target.tagName, target.contentEditable) && target.text !== '';
  return !typing && isOneOf(arrows, event.key) ? event.key : null;
}

export function stepRow<T extends { convId: string }>(
  rows: readonly T[], convId: string | null, arrow: VerticalArrow,
): T | null {
  const index = rows.findIndex(row => row.convId === convId);
  return index === -1 ? null : rows[index + (arrow === 'ArrowUp' ? -1 : 1)] ?? null;
}

export function revealScrollDelta(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  if (top < viewTop) return top - viewTop;
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop);
  return 0;
}
