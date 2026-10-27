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
  items: readonly SortItemLayout[];
}

export interface SortOrigin { itemId: string; listId: string; index: number }

export interface SortTarget { listId: string; index: number }

export type SortStep = 'backward' | 'forward' | 'previousList' | 'nextList';

export function rectContains(rect: SortRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function listAt(lists: readonly SortListLayout[], x: number, y: number): SortListLayout | undefined {
  const hits = lists.filter(list => rectContains(list.rect, x, y));
  return hits.sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0];
}

function others(list: SortListLayout, itemId: string): readonly SortItemLayout[] {
  return list.items.filter(item => item.id !== itemId);
}

export function insertionIndex(list: SortListLayout, itemId: string, x: number, y: number): number {
  const point = list.direction === 'vertical' ? y : x;
  return others(list, itemId).filter((item) => {
    const middle = list.direction === 'vertical' ? item.rect.y + item.rect.height / 2 : item.rect.x + item.rect.width / 2;
    return middle < point;
  }).length;
}

export function sortMove(origin: SortOrigin, target: SortListLayout, index: number): SortMove {
  const ids = others(target, origin.itemId).map(item => item.id);
  return {
    itemId: origin.itemId,
    fromListId: origin.listId,
    toListId: target.listId,
    fromIndex: origin.index,
    toIndex: index,
    beforeId: ids[index - 1] ?? null,
    afterId: ids[index] ?? null,
  };
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
    const last = others(list, itemId).length;
    const index = current.index + (step === 'forward' ? 1 : -1);
    return { listId: list.listId, index: Math.max(0, Math.min(last, index)) };
  }
  const next = lists[at + (step === 'nextList' ? 1 : -1)];
  if (next === undefined) return current;
  return { listId: next.listId, index: Math.min(current.index, others(next, itemId).length) };
}

export function indicatorRect(list: SortListLayout, itemId: string, index: number, thickness: number): SortRect {
  const items = others(list, itemId);
  const vertical = list.direction === 'vertical';
  const before = items[index - 1]?.rect;
  const after = items[index]?.rect;
  const start = vertical ? list.rect.y : list.rect.x;
  const edge = (rect: SortRect | undefined, end: boolean): number | undefined => {
    if (rect === undefined) return undefined;
    if (vertical) return end ? rect.y + rect.height : rect.y;
    return end ? rect.x + rect.width : rect.x;
  };
  const low = edge(before, true);
  const high = edge(after, false);
  const middle = low !== undefined && high !== undefined ? (low + high) / 2 : low ?? high ?? start;
  const offset = middle - start - thickness / 2;
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
