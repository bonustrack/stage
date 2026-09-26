import {
  deriveBarLabels, filterChannelRows, sortChannelRows, type ChannelListRow,
} from '@stage-labs/client/xmtp/channelsFilter';
import { MAX_LABEL_LEN } from '@stage-labs/client/xmtp/labels';

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

export function labelCarriers(rows: readonly ChannelListRow[], label: string): string[] {
  const key = label.toLowerCase();
  return rows.filter(r => !r.peerAddress && (r.labels ?? []).some(l => l.toLowerCase() === key)).map(r => r.convId);
}

const typedName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export function renameProblem(name: string): string | null {
  const typed = typedName(name);
  if (typed === '') return 'Enter a name.';
  return typed.length > MAX_LABEL_LEN ? `Use at most ${MAX_LABEL_LEN} characters.` : null;
}

export function addColumnProblem(columns: readonly BoardColumn<unknown>[], name: string): string | null {
  const problem = renameProblem(name);
  if (problem !== null) return problem;
  const key = typedName(name).toLowerCase();
  const taken = columns.map(c => c.label ?? UNLABELED_TITLE).find(title => title.toLowerCase() === key);
  return taken === undefined ? null : `A column named ${taken} already exists.`;
}

export function addedColumnOrder(shown: readonly string[], saved: readonly string[], name: string): string[] {
  return [...withShown(saved, shown), labelColumnKey(typedName(name))];
}

export function renameTarget(
  columns: readonly BoardColumn<unknown>[], from: string, name: string,
): { name: string; merge: boolean } {
  const typed = typedName(name);
  const key = typed.toLowerCase();
  const existing = key === from.toLowerCase() ? null : columns.find(c => c.label?.toLowerCase() === key)?.label;
  return existing == null ? { name: typed, merge: false } : { name: existing, merge: true };
}

export type TitleCommit = 'enter' | 'blur';
export type TitleEdit = { kind: 'save'; name: string } | { kind: 'close' } | { kind: 'stay' };

const unsaved = (via: TitleCommit): TitleEdit => (via === 'blur' ? { kind: 'close' } : { kind: 'stay' });

export function draftEdit(columns: readonly BoardColumn<unknown>[], name: string, via: TitleCommit): TitleEdit {
  if (typedName(name) === '') return unsaved(via);
  return addColumnProblem(columns, name) === null ? { kind: 'save', name: typedName(name) } : { kind: 'stay' };
}

export function draftNote(columns: readonly BoardColumn<unknown>[], name: string, tried: boolean): string | null {
  return tried || typedName(name) !== '' ? addColumnProblem(columns, name) : null;
}

export function renameEdit(
  columns: readonly BoardColumn<unknown>[], from: string, name: string, via: TitleCommit,
): TitleEdit {
  if (renameProblem(name) !== null) return unsaved(via);
  const target = renameTarget(columns, from, name);
  return target.name === from ? { kind: 'close' } : { kind: 'save', name: target.name };
}

export function renameNote(
  columns: readonly BoardColumn<unknown>[], from: string, name: string, tried: boolean,
): string | null {
  const problem = renameProblem(name);
  if (problem !== null) return tried || typedName(name) !== '' ? problem : null;
  const target = renameTarget(columns, from, name);
  return target.merge ? `Channels move into the ${target.name} column.` : null;
}

export function renamedColumnOrder(
  shown: readonly string[], saved: readonly string[], from: string, to: string,
): string[] {
  const fromKey = labelColumnKey(from).toLowerCase();
  const toKey = labelColumnKey(to);
  const full = withShown(saved, shown);
  const merging = full.some(key => key.toLowerCase() === toKey.toLowerCase() && key.toLowerCase() !== fromKey);
  return full.flatMap((key) => {
    if (key.toLowerCase() !== fromKey) return [key];
    return merging ? [] : [toKey];
  });
}

function labelIds(raw: string): { id: string; name: string }[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((e: unknown) => (
      typeof e === 'object' && e !== null && 'id' in e && 'name' in e
        && typeof e.id === 'string' && typeof e.name === 'string' ? [{ id: e.id, name: e.name }] : []
    ));
  } catch { return []; }
}

export function namedBoardOrder(order: readonly string[], registry: string): string[] {
  const entries = labelIds(registry).map(e => ({ id: labelColumnKey(e.id), name: labelColumnKey(e.name) }));
  const named = (key: string): string | undefined => {
    const lower = key.toLowerCase();
    return (entries.find(e => e.id === key) ?? entries.find(e => e.name.toLowerCase() === lower)
      ?? entries.find(e => e.id.toLowerCase() === lower))?.name;
  };
  const seen = new Set<string>();
  return order.flatMap((key) => {
    const next = named(key) ?? key;
    if (seen.has(next.toLowerCase())) return [];
    seen.add(next.toLowerCase());
    return [next];
  });
}
