import { isEditableTarget } from '../bubble/imageGallery.model';

export type BoardArrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export interface BoardKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

export interface BoardKeyTarget {
  tagName: string | null;
  contentEditable: boolean;
  text: string;
}

interface NavColumn {
  key: string;
  rows: readonly { convId: string }[];
}

export interface BoardCardRef {
  key: string;
  convId: string;
}

const ARROWS: ReadonlySet<string> = new Set<BoardArrow>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const isArrow = (key: string): key is BoardArrow => ARROWS.has(key);

export function boardArrowOf(event: BoardKeyEvent, target: BoardKeyTarget | null): BoardArrow | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const typing = target !== null && isEditableTarget(target.tagName, target.contentEditable) && target.text !== '';
  return !typing && isArrow(event.key) ? event.key : null;
}

function sideways(columns: readonly NavColumn[], from: number, step: number, row: number): BoardCardRef | null {
  for (let index = from + step; index >= 0 && index < columns.length; index += step) {
    const column = columns[index];
    const card = column?.rows[Math.min(row, column.rows.length - 1)];
    if (column !== undefined && card !== undefined) return { key: column.key, convId: card.convId };
  }
  return null;
}

export function boardArrowMove(
  columns: readonly NavColumn[], columnIndex: number, convId: string | null, arrow: BoardArrow,
): BoardCardRef | null {
  const column = columns[columnIndex];
  const row = column?.rows.findIndex(r => r.convId === convId) ?? -1;
  if (column === undefined || row === -1) return null;
  if (arrow === 'ArrowLeft' || arrow === 'ArrowRight') {
    return sideways(columns, columnIndex, arrow === 'ArrowLeft' ? -1 : 1, row);
  }
  const card = column.rows[row + (arrow === 'ArrowUp' ? -1 : 1)];
  return card === undefined ? null : { key: column.key, convId: card.convId };
}

export function revealScrollDelta(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  if (top < viewTop) return top - viewTop;
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop);
  return 0;
}
