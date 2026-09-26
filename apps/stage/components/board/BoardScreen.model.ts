import {
  deriveBarLabels, sortChannelRows, type ChannelListRow,
} from '@stage-labs/client/xmtp/channelsFilter';
import {
  labelIndex, labelKey, labelNames, resolveLabel, withLabelNames, type LabelEntry, type LabelIndex,
} from '@stage-labs/client/xmtp/labelRegistry';
import { MAX_LABEL_LEN } from '@stage-labs/client/xmtp/labels';

export const UNLABELED_TITLE = 'Unlabeled';
export const BOARD_GAP = 12;
export const BOARD_COLUMN_WIDTH = 340;

const LABEL_PREFIX = 'label:';
const UNLABELED_KEY = 'unlabeled';

export interface BoardColumn<T> {
  key: string;
  label: string | null;
  entry: LabelEntry | null;
  rows: T[];
}

export const labelColumnKey = (id: string): string => `${LABEL_PREFIX}${id}`;

function keyRef(key: string): string {
  return key.startsWith(LABEL_PREFIX) ? key.slice(LABEL_PREFIX.length) : '';
}

function keyedEntry(entries: readonly LabelEntry[], key: string): LabelEntry | null {
  const ref = keyRef(key);
  if (labelKey(ref) === '') return null;
  return entries.find(e => e.id === ref.toLowerCase()) ?? resolveLabel(entries, ref);
}

export function orderLabelNames(order: readonly string[], entries: readonly LabelEntry[]): string[] {
  const ids = new Set(entries.map(e => e.id));
  return order.map(keyRef).filter(ref => labelKey(ref) !== '' && !ids.has(ref.toLowerCase()));
}

export function boardLabelNames(
  rows: readonly ChannelListRow[], order: readonly string[], entries: readonly LabelEntry[],
): string[] {
  return [...deriveBarLabels(rows), ...orderLabelNames(order, entries)];
}

export function boardEntries(
  rows: readonly ChannelListRow[], order: readonly string[], entries: readonly LabelEntry[],
): readonly LabelEntry[] {
  return withLabelNames(entries, boardLabelNames(rows, order, entries));
}

export function normalizedOrder(order: readonly string[], entries: readonly LabelEntry[]): string[] {
  const seen = new Set<string>();
  return order.flatMap((key) => {
    const entry = keyedEntry(entries, key);
    const next = entry === null ? key : labelColumnKey(entry.id);
    if (seen.has(next.toLowerCase())) return [];
    seen.add(next.toLowerCase());
    return [next];
  });
}

function shownEntries(
  known: readonly LabelEntry[], index: LabelIndex, labels: readonly string[], order: readonly string[],
): LabelEntry[] {
  const shown = new Map<string, LabelEntry>();
  for (const label of labels) {
    const entry = index.get(labelKey(label));
    if (entry !== undefined) shown.set(entry.id, entry);
  }
  const fromChats = [...shown.values()].sort((a, b) => a.name.localeCompare(b.name));
  const remembered = order.flatMap((key) => {
    const entry = keyedEntry(known, key);
    if (entry === null || shown.has(entry.id)) return [];
    shown.set(entry.id, entry);
    return [entry];
  });
  return [...fromChats, ...remembered];
}

export function boardColumns<T extends ChannelListRow>(
  rows: T[], pinned: readonly string[], order: readonly string[],
  entries: readonly LabelEntry[] = [], hidden: (row: T) => boolean = () => false,
): BoardColumn<T>[] {
  const known = boardEntries(rows, order, entries);
  const index = labelIndex(known);
  const sorted = sortChannelRows(rows.filter(row => !row.peerAddress && !hidden(row)), pinned);
  const labeled = shownEntries(known, index, deriveBarLabels(rows), order).map(entry => ({
    key: labelColumnKey(entry.id),
    label: entry.name,
    entry,
    rows: sorted.filter(row => (row.labels ?? []).some(label => index.get(labelKey(label))?.id === entry.id)),
  }));
  if (labeled.length === 0 && sorted.length === 0) return [];
  const unlabeled = sorted.filter(r => (r.labels ?? []).length === 0);
  return [...labeled, { key: UNLABELED_KEY, label: null, entry: null, rows: unlabeled }];
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

export function cardLabel(columns: readonly BoardColumn<ChannelListRow>[], convId: string, key: string): string | null {
  const column = columns.find(c => c.key === key);
  if (column?.entry == null) return null;
  const names = new Set(labelNames(column.entry).map(labelKey));
  const row = column.rows.find(r => r.convId === convId);
  return row?.labels?.find(label => names.has(labelKey(label))) ?? column.label;
}

export function labelCarriers(rows: readonly ChannelListRow[], entry: LabelEntry): string[] {
  const names = new Set(labelNames(entry).map(labelKey));
  return rows.filter(r => !r.peerAddress && (r.labels ?? []).some(label => names.has(labelKey(label)))).map(r => r.convId);
}

export function renameProblem(entries: readonly LabelEntry[], entry: LabelEntry, name: string): string | null {
  const typed = name.trim().replace(/\s+/g, ' ');
  if (typed === '') return 'Enter a name.';
  if (typed.length > MAX_LABEL_LEN) return `Use at most ${MAX_LABEL_LEN} characters.`;
  const taken = entries.some(e => e.id !== entry.id && labelKey(e.name) === labelKey(typed));
  return taken ? 'Another column already has this name.' : null;
}
