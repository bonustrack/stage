import {
  deriveBarLabels, filterChannelRows, sortChannelRows, type ChannelListRow,
} from '@stage-labs/client/xmtp/channelsFilter';

export const UNLABELED_TITLE = 'Unlabeled';
export const BOARD_GAP = 12;
export const BOARD_COLUMN_WIDTH = 340;

const LABEL_PREFIX = 'label:';
const UNLABELED_KEY = 'unlabeled';

export interface BoardColumn<T> {
  key: string;
  label: string | null;
  rows: T[];
}

export const labelColumnKey = (label: string): string => `${LABEL_PREFIX}${label}`;

function rememberedLabels(order: readonly string[], known: readonly string[]): string[] {
  const seen = new Set(known.map(label => label.toLowerCase()));
  return order.flatMap((key) => {
    const label = key.startsWith(LABEL_PREFIX) ? key.slice(LABEL_PREFIX.length) : '';
    if (label === '' || seen.has(label.toLowerCase())) return [];
    seen.add(label.toLowerCase());
    return [label];
  });
}

export function boardColumns<T extends ChannelListRow>(
  rows: T[], pinned: readonly string[], order: readonly string[], hidden: (row: T) => boolean = () => false,
): BoardColumn<T>[] {
  const chatLabels = deriveBarLabels(rows);
  const sorted = sortChannelRows(rows.filter(row => !row.peerAddress && !hidden(row)), pinned);
  const labeled = [...chatLabels, ...rememberedLabels(order, chatLabels)].map(label => ({
    key: labelColumnKey(label),
    label,
    rows: filterChannelRows(sorted, { enabledLabels: new Set([label.toLowerCase()]) }),
  }));
  if (labeled.length === 0 && sorted.length === 0) return [];
  const unlabeled = sorted.filter(r => (r.labels ?? []).length === 0);
  return [...labeled, { key: UNLABELED_KEY, label: null, rows: unlabeled }];
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
  const saved = new Map<string, number>();
  order.forEach((key, index) => { if (!saved.has(key.toLowerCase())) saved.set(key.toLowerCase(), index); });
  const rank = (key: string, index: number): number => saved.get(key.toLowerCase()) ?? order.length + index;
  return columns.map((column, index) => ({ column, rank: rank(column.key, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ column }) => column);
}

function withShown(saved: readonly string[], shown: readonly string[]): string[] {
  const current = new Map(shown.map(key => [key.toLowerCase(), key]));
  const seen = new Set<string>();
  const kept = saved.flatMap((key) => {
    if (seen.has(key.toLowerCase())) return [];
    seen.add(key.toLowerCase());
    return [current.get(key.toLowerCase()) ?? key];
  });
  return [...kept, ...shown.filter(key => !seen.has(key.toLowerCase()))];
}

export function movedColumnOrder(
  shown: readonly string[], saved: readonly string[], from: string, to: string,
): string[] | null {
  if (from === to || !shown.includes(from) || !shown.includes(to)) return null;
  const full = withShown(saved, shown);
  const target = full.indexOf(to);
  const next = full.filter(key => key !== from);
  next.splice(target, 0, from);
  return next;
}

export function keptColumnOrder(
  columns: readonly BoardColumn<unknown>[], saved: readonly string[], from: string,
): string[] | null {
  const column = columns.find(c => c.key === from);
  if (column?.label == null || column.rows.length > 1) return null;
  const next = withShown(saved, columns.map(c => c.key));
  return next.length === saved.length && next.every((key, index) => key === saved[index]) ? null : next;
}

export function columnLabel(columns: readonly BoardColumn<unknown>[], key: string): string | null {
  return columns.find(column => column.key === key)?.label ?? null;
}
