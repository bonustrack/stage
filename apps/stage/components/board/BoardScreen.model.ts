import {
  deriveBarLabels, filterChannelRows, sortChannelRows, type ChannelListRow,
} from '@stage-labs/client/xmtp/channelsFilter';

export const UNLABELED_TITLE = 'Unlabeled';
export const BOARD_GAP = 12;
export const BOARD_COLUMN_WIDTH = 340;

export interface BoardColumn<T> {
  key: string;
  label: string | null;
  rows: T[];
}

export function boardColumns<T extends ChannelListRow>(rows: T[], pinned: readonly string[]): BoardColumn<T>[] {
  const sorted = sortChannelRows(rows, pinned);
  const labeled = deriveBarLabels(sorted).map((label) => {
    const key = label.toLowerCase();
    return { key: `label:${key}`, label, rows: filterChannelRows(sorted, { enabledLabels: new Set([key]) }) };
  });
  const unlabeled = sorted.filter(r => (r.labels ?? []).length === 0);
  if (unlabeled.length === 0) return labeled;
  return [...labeled, { key: 'unlabeled', label: null, rows: unlabeled }];
}

export type BoardDrag = { kind: 'column'; key: string } | { kind: 'card'; convId: string; from: string };

export interface BoardDragSource {
  nativeID?: string;
  dragging: boolean;
}

export interface BoardDropZone {
  nativeID?: string;
  over: boolean;
}

export function acceptsDrop(drag: BoardDrag, key: string): boolean {
  return (drag.kind === 'column' ? drag.key : drag.from) !== key;
}

export function orderedColumns<C extends { key: string }>(columns: readonly C[], order: readonly string[]): C[] {
  const rank = (key: string, index: number): number => {
    const saved = order.indexOf(key);
    return saved === -1 ? order.length + index : saved;
  };
  return columns.map((column, index) => ({ column, rank: rank(column.key, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ column }) => column);
}

export function movedColumnOrder(
  shown: readonly string[], saved: readonly string[], from: string, to: string,
): string[] | null {
  const target = shown.indexOf(to);
  if (from === to || target === -1 || !shown.includes(from)) return null;
  const next = shown.filter(key => key !== from);
  next.splice(target, 0, from);
  return [...next, ...saved.filter(key => !next.includes(key))];
}

export function columnLabel(columns: readonly BoardColumn<unknown>[], key: string): string | null {
  return columns.find(column => column.key === key)?.label ?? null;
}
