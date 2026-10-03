import { sortChannelRows, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { MAX_LABELS, MAX_LABEL_LEN } from '@stage-labs/client/xmtp/labels';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { NO_GROUP_TITLES, groupTitleOf, groupValuesOf, type GroupableRow, type NameOf } from '../home/groupBy.model';
import { compareNames } from '../../lib/format';
import { parseSearchFilter, searchRowMatcher, type FilterRow, type MemberNames } from '../searchFilter.model';

export const BOARD_GAP = 12;
export const BOARD_COLUMN_WIDTH = 340;

const LABEL_PREFIX = 'label:';

export interface BoardColumn<T> {
  key: string;
  label: string;
  rows: T[];
}

export const labelColumnKey = (label: string): string => `${LABEL_PREFIX}${label}`;

export const columnKeyOf = (by: GroupKey, value: string): string => (by === 'label' ? labelColumnKey(value) : `${by}:${value}`);

export const columnsEditable = (by: GroupKey): boolean => by === 'label';

function rememberedLabels(order: readonly string[], known: ReadonlySet<string>): BoardColumn<never>[] {
  const seen = new Set(known);
  return order.flatMap((key) => {
    const label = key.startsWith(LABEL_PREFIX) ? key.slice(LABEL_PREFIX.length) : '';
    if (label === '' || seen.has(label.toLowerCase())) return [];
    seen.add(label.toLowerCase());
    return [{ key, label, rows: [] }];
  });
}

function valueColumns<T extends GroupableRow>(
  rows: readonly T[], by: GroupKey, nameOf: NameOf, hidden: (row: T) => boolean,
): BoardColumn<T>[] {
  const columns = new Map<string, BoardColumn<T>>();
  const none: BoardColumn<T> = { key: columnKeyOf(by, ''), label: NO_GROUP_TITLES[by], rows: [] };
  for (const row of rows) {
    const values = groupValuesOf(row, by);
    if (values.length === 0 && !hidden(row)) none.rows.push(row);
    for (const value of values) {
      const id = value.toLowerCase();
      let column = columns.get(id);
      if (column === undefined) {
        column = { key: columnKeyOf(by, value), label: groupTitleOf(by, value, nameOf), rows: [] };
        columns.set(id, column);
      }
      if (!hidden(row)) column.rows.push(row);
    }
  }
  const sorted = [...columns.values()].sort((a, b) => compareNames(a.label, b.label));
  return [...sorted, ...(by !== 'label' && none.rows.length > 0 ? [none] : [])];
}

export function boardColumns<T extends ChannelListRow & GroupableRow>(
  rows: T[], pinned: readonly string[], order: readonly string[], by: GroupKey = 'label',
  nameOf: NameOf = value => value, hidden: (row: T) => boolean = () => false,
): BoardColumn<T>[] {
  const columns = valueColumns(sortChannelRows(rows.filter(row => !row.peerAddress), pinned), by, nameOf, hidden);
  if (by !== 'label') return columns;
  return [...columns, ...rememberedLabels(order, new Set(columns.map(column => column.label.toLowerCase())))];
}

export function searchedColumns<T extends FilterRow>(
  columns: BoardColumn<T>[], query: string, namesOf: MemberNames = () => [], draftOf: (convId: string) => string = () => '',
): BoardColumn<T>[] {
  const matches = searchRowMatcher(parseSearchFilter(query), namesOf, draftOf);
  return columns.map(column => ({ ...column, rows: column.rows.filter(matches) }));
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
  if (column === undefined || column.rows.length > 1) return null;
  const next = withShown(saved, columns.map(c => c.key));
  return next.length === saved.length && next.every((key, index) => key === saved[index]) ? null : next;
}

export function columnLabel(columns: readonly BoardColumn<unknown>[], key: string): string | null {
  return columns.find(column => column.key === key)?.label ?? null;
}

const carries = (row: ChannelListRow, key: string): boolean => (row.labels ?? []).some(l => l.toLowerCase() === key);

export function labelCarriers(rows: readonly ChannelListRow[], label: string): string[] {
  const key = label.toLowerCase();
  return rows.filter(r => !r.peerAddress && carries(r, key)).map(r => r.convId);
}

export function addItemRows<T extends ChannelListRow>(
  rows: readonly T[], label: string, query: string, picked: readonly string[],
): T[] {
  const key = label.toLowerCase();
  const needle = query.trim().toLowerCase();
  return sortChannelRows(rows.filter(r => !r.peerAddress && !carries(r, key)
    && (picked.includes(r.convId) || r.title.toLowerCase().includes(needle))));
}

const typedName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export function labelCapNote(added: readonly (readonly string[])[], label: string): string | null {
  const key = typedName(label).slice(0, MAX_LABEL_LEN).toLowerCase();
  const full = added.filter(labels => !labels.some(l => l.toLowerCase() === key)).length;
  if (full === 0) return null;
  return full === 1
    ? `1 channel already has ${MAX_LABELS} labels.`
    : `${full} channels already have ${MAX_LABELS} labels.`;
}

export function renameProblem(name: string): string | null {
  const typed = typedName(name);
  if (typed === '') return 'Enter a name.';
  return typed.length > MAX_LABEL_LEN ? `Use at most ${MAX_LABEL_LEN} characters.` : null;
}

export function addColumnProblem(columns: readonly BoardColumn<unknown>[], name: string): string | null {
  const problem = renameProblem(name);
  if (problem !== null) return problem;
  const key = typedName(name).toLowerCase();
  const taken = columns.find(c => c.label.toLowerCase() === key)?.label;
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
  const existing = key === from.toLowerCase() ? null : columns.find(c => c.label.toLowerCase() === key)?.label;
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

export function deletedColumnOrder(shown: readonly string[], saved: readonly string[], label: string): string[] {
  const key = labelColumnKey(label).toLowerCase();
  return withShown(saved, shown).filter(k => k.toLowerCase() !== key);
}

export function deleteColumnConfirm(label: string, carriers: number): { title: string; message: string } {
  const channels = carriers === 1 ? '1 channel' : `${carriers} channels`;
  return {
    title: 'Delete column',
    message: carriers === 0
      ? `No channel has the ${label} label.`
      : `This removes the ${label} label from ${channels}. Channels with no other label leave the board.`,
  };
}

export function activeColumnIndex(
  columns: readonly { key: string; rows: readonly { convId: string }[] }[], convId: string | null, from: string | null = null,
): number {
  const holds = (column: (typeof columns)[number]): boolean => column.rows.some(row => row.convId === convId);
  const preferred = columns.findIndex(column => column.key === from && holds(column));
  return preferred === -1 ? columns.findIndex(holds) : preferred;
}

export function revealScrollX(index: number, scrollX: number, viewport: number, gutter: number): number {
  const left = index * (BOARD_COLUMN_WIDTH + BOARD_GAP);
  const right = left + BOARD_COLUMN_WIDTH + 2 * gutter - viewport;
  if (scrollX > left) return left;
  if (scrollX < right) return Math.min(left, right);
  return scrollX;
}

export function cardsRightPadding(padding: number, scrollWidth: number, contentWidth: number): number {
  if (contentWidth <= 0) return padding;
  return Math.max(0, padding - Math.max(0, scrollWidth - contentWidth));
}

export type BoardCardPress = 'push' | 'replace' | 'close';

export function boardCardPress(openConvId: string | null, convId: string): BoardCardPress {
  if (openConvId === null) return 'push';
  return openConvId === convId ? 'close' : 'replace';
}
