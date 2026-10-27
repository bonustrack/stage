export type SortDirection = 'vertical' | 'horizontal';

export interface SortRect { x: number; y: number; width: number; height: number }

export interface SortMove {
  itemId: string;
  fromListId: string;
  toListId: string;
  fromIndex: number;
  toIndex: number;
  beforeId: string | null;
  afterId: string | null;
}

export interface SortItemLayout { id: string; rect: SortRect }

export interface SortListLayout {
  listId: string;
  direction: SortDirection;
  rect: SortRect;
  ids: readonly string[];
  items: readonly SortItemLayout[];
}

export interface SortOrigin { itemId: string; listId: string; index: number }

export interface SortTarget { listId: string; index: number }

export type SortStep = 'backward' | 'forward' | 'previousList' | 'nextList';

export interface SortSlot { listId: string; beforeId: string | null; afterId: string | null }

export function rectContains(rect: SortRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function listAt(lists: readonly SortListLayout[], x: number, y: number): SortListLayout | undefined {
  const hits = lists.filter(list => rectContains(list.rect, x, y));
  return hits.sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0];
}

function gapTo(start: number, size: number, point: number): number {
  return point < start ? start - point : Math.max(0, point - start - size);
}

export function nearestList(lists: readonly SortListLayout[], x: number, y: number): SortListLayout | undefined {
  const across = lists.filter(({ direction, rect }) => (
    direction === 'vertical' ? x >= rect.x && x <= rect.x + rect.width : y >= rect.y && y <= rect.y + rect.height
  ));
  const distance = ({ direction, rect }: SortListLayout): number => (
    direction === 'vertical' ? gapTo(rect.y, rect.height, y) : gapTo(rect.x, rect.width, x)
  );
  return across.sort((a, b) => distance(a) - distance(b))[0];
}

export function unionRect(rects: readonly (SortRect | null)[]): SortRect | null {
  const known = rects.filter((rect): rect is SortRect => rect !== null);
  if (known.length === 0) return null;
  const x = Math.min(...known.map(r => r.x));
  const y = Math.min(...known.map(r => r.y));
  return { x, y, width: Math.max(...known.map(r => r.x + r.width)) - x, height: Math.max(...known.map(r => r.y + r.height)) - y };
}

function others(list: SortListLayout, itemId: string): readonly SortItemLayout[] {
  return list.items.filter(item => item.id !== itemId);
}

function otherIds(list: SortListLayout, itemId: string): readonly string[] {
  return list.ids.filter(id => id !== itemId);
}

function middleOf(list: SortListLayout, rect: SortRect): number {
  return list.direction === 'vertical' ? rect.y + rect.height / 2 : rect.x + rect.width / 2;
}

export function insertionIndex(list: SortListLayout, itemId: string, x: number, y: number): number {
  const point = list.direction === 'vertical' ? y : x;
  const ids = otherIds(list, itemId);
  const measured = others(list, itemId).filter(item => ids.includes(item.id));
  const before = measured.filter(item => middleOf(list, item.rect) < point).pop();
  if (before !== undefined) return ids.indexOf(before.id) + 1;
  const after = measured[0];
  return after === undefined ? 0 : ids.indexOf(after.id);
}

export function sortMove(origin: SortOrigin, target: SortListLayout, index: number): SortMove {
  const { beforeId, afterId } = slotAt(target.listId, target.ids, origin.itemId, index);
  return { itemId: origin.itemId, fromListId: origin.listId, toListId: target.listId, fromIndex: origin.index, toIndex: index, beforeId, afterId };
}

export function slotAt(listId: string, ids: readonly string[], itemId: string, index: number): SortSlot {
  const rest = ids.filter(id => id !== itemId);
  return { listId, beforeId: rest[index - 1] ?? null, afterId: rest[index] ?? null };
}

export function moveAnchor(move: Pick<SortMove, 'fromIndex' | 'toIndex' | 'beforeId' | 'afterId'>): string | null {
  return move.toIndex > move.fromIndex ? move.beforeId : move.afterId;
}

export function isNoMove(move: SortMove): boolean {
  return move.fromListId === move.toListId && move.fromIndex === move.toIndex;
}

export function stepTarget(
  lists: readonly SortListLayout[], itemId: string, current: SortTarget, step: SortStep,
): SortTarget {
  const at = lists.findIndex(list => list.listId === current.listId);
  const list = lists[at];
  if (list === undefined) return current;
  if (step === 'backward' || step === 'forward') {
    const last = otherIds(list, itemId).length;
    const index = current.index + (step === 'forward' ? 1 : -1);
    return { listId: list.listId, index: Math.max(0, Math.min(last, index)) };
  }
  const next = lists[at + (step === 'nextList' ? 1 : -1)];
  if (next === undefined) return current;
  return { listId: next.listId, index: Math.min(current.index, otherIds(next, itemId).length) };
}

function rectOf(list: SortListLayout, id: string | undefined): SortRect | undefined {
  return id === undefined ? undefined : list.items.find(item => item.id === id)?.rect;
}

export function indicatorRect(list: SortListLayout, itemId: string, index: number, thickness: number): SortRect {
  const ids = otherIds(list, itemId);
  const vertical = list.direction === 'vertical';
  const before = rectOf(list, ids[index - 1]);
  const after = rectOf(list, ids[index]);
  const start = vertical ? list.rect.y : list.rect.x;
  const edge = (rect: SortRect | undefined, end: boolean): number | undefined => {
    if (rect === undefined) return undefined;
    if (vertical) return end ? rect.y + rect.height : rect.y;
    return end ? rect.x + rect.width : rect.x;
  };
  const low = edge(before, true);
  const high = edge(after, false);
  const middle = low !== undefined && high !== undefined ? (low + high) / 2 : low ?? high ?? start;
  const size = vertical ? list.rect.height : list.rect.width;
  const offset = Math.max(0, Math.min(size - thickness, middle - start - thickness / 2));
  return vertical
    ? { x: 0, y: offset, width: list.rect.width, height: thickness }
    : { x: offset, y: 0, width: thickness, height: list.rect.height };
}

export function movedItems<T>(
  source: readonly T[], target: readonly T[] | null, fromIndex: number, toIndex: number,
): { source: T[]; target: T[] } {
  const item = source[fromIndex];
  const rest = source.filter((_, index) => index !== fromIndex);
  if (item === undefined) return { source: [...source], target: [...(target ?? source)] };
  const into = target === null ? rest : [...target];
  const at = Math.max(0, Math.min(toIndex, into.length));
  const placed = [...into.slice(0, at), item, ...into.slice(at)];
  return target === null ? { source: placed, target: placed } : { source: rest, target: placed };
}

export function shiftOf(index: number, fromIndex: number, toIndex: number, size: number): number {
  if (index > fromIndex && index <= toIndex) return -size;
  if (index < fromIndex && index >= toIndex) return size;
  return 0;
}
