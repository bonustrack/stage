import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { movedKey, savedFirst } from '@stage-labs/client/xmtp/pinOrder';
import { CHANNEL_FIELD_NOUNS, MAX_LABEL_LEN } from '@stage-labs/client/xmtp/labels';
import { DEFAULT_HOME_VIEW, type GroupKey, type HomeSort } from '@stage-labs/client/xmtp/readState';
import { homeSortOf, sortHomeRows } from '../home/sort.model';
import { NO_GROUP_TITLES, bucketRows, groupTitleOf, groupValuesOf, type GroupableRow, type NameOf } from '../home/groupBy.model';
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

export type EditableColumnBy = Exclude<GroupKey, 'assignee'>;

export const columnsEditable = (by: GroupKey): by is EditableColumnBy => by !== 'assignee';

export const columnNoun = (by: EditableColumnBy): string => (by === 'label' ? by : CHANNEL_FIELD_NOUNS[by]);

function rememberedColumns(order: readonly string[], known: ReadonlySet<string>, by: GroupKey, nameOf: NameOf): BoardColumn<never>[] {
  const seen = new Set(known);
  const prefix = columnKeyOf(by, '');
  return order.flatMap((key) => {
    const label = key.startsWith(prefix) ? key.slice(prefix.length) : '';
    if (label === '' || seen.has(key.toLowerCase())) return [];
    seen.add(key.toLowerCase());
    return [{ key, label: groupTitleOf(by, label, nameOf), rows: [] }];
  });
}

function valueColumns<T extends GroupableRow>(
  rows: readonly T[], by: GroupKey, nameOf: NameOf, hidden: (row: T) => boolean,
): BoardColumn<T>[] {
  const { buckets, none } = bucketRows(rows, by, nameOf, value => columnKeyOf(by, value));
  const shown = (list: readonly T[]): T[] => list.filter(row => !hidden(row));
  const columns = buckets.map(({ key, title, rows: inBucket }) => ({ key, label: title, rows: shown(inBucket) }));
  const rest = shown(none);
  const showUnset = by !== 'label' && (rest.length > 0 || (by === 'status' && columns.some(column => column.rows.length > 0)));
  return [
    ...columns.sort((a, b) => compareNames(a.label, b.label)),
    ...(showUnset ? [{ key: columnKeyOf(by, ''), label: NO_GROUP_TITLES[by], rows: rest }] : []),
  ];
}

export function boardColumns<T extends ChannelListRow & GroupableRow>(
  rows: T[], pinned: readonly string[], order: readonly string[], by: GroupKey = DEFAULT_HOME_VIEW.columnBy,
  nameOf: NameOf = value => value, hidden: (row: T) => boolean = () => false,
  sort: HomeSort = homeSortOf({ ...DEFAULT_HOME_VIEW, view: 'board' }), statusOrder: readonly string[] = order,
): BoardColumn<T>[] {
  const columns = valueColumns(sortHomeRows(rows.filter(row => !row.peerAddress), pinned, sort, statusOrder), by, nameOf, hidden);
  return [...columns, ...rememberedColumns(order, new Set(columns.map(column => column.key.toLowerCase())), by, nameOf)];
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

export const columnMovable = (key: string): boolean => key !== columnKeyOf('category', '') && key !== columnKeyOf('status', '');

export const columnEditable = (key: string): boolean => (
  ['label', 'status', 'category'].some(by => key.startsWith(`${by}:`) && key !== `${by}:`)
);

export function acceptsDrop(drag: BoardDrag, key: string): boolean {
  if (drag.kind === 'card') return drag.from !== key;
  return drag.key !== key && columnMovable(key);
}

export function orderedColumns<C extends { key: string }>(columns: readonly C[], order: readonly string[]): C[] {
  return savedFirst(columns, order.map(key => key.toLowerCase()), column => column.key.toLowerCase());
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
  return movedKey(withShown(saved, shown), from, to);
}

export function keptColumnOrder(
  columns: readonly BoardColumn<unknown>[], saved: readonly string[], from: string,
): string[] | null {
  const column = columns.find(c => c.key === from);
  if (column === undefined || column.rows.length > 1) return null;
  const next = withShown(saved, columns.map(c => c.key));
  return next.length === saved.length && next.every((key, index) => key === saved[index]) ? null : next;
}

type CardColumnEdit = { by: 'status' | 'category'; value: string | null } | { by: 'label'; from: string; to: string };

export function cardColumnEdit(
  columns: readonly BoardColumn<unknown>[], from: string, to: string, by: GroupKey,
): CardColumnEdit | null {
  if (!columnsEditable(by) || from === to) return null;
  const prefix = columnKeyOf(by, '');
  if (!from.startsWith(prefix) || !to.startsWith(prefix)) return null;
  const source = columns.find(column => column.key === from);
  const target = columns.find(column => column.key === to);
  if (!source || !target) return null;
  return by === 'label'
    ? { by, from: source.label, to: target.label }
    : { by, value: to === prefix ? null : target.label };
}

const carries = (row: GroupableRow, key: string, by: EditableColumnBy): boolean => (
  groupValuesOf(row, by).some(value => value.toLowerCase() === key)
);

export function columnCarriers(rows: readonly ChannelListRow[], value: string, by: EditableColumnBy): string[] {
  const key = value.toLowerCase();
  return rows.filter(r => !r.peerAddress && carries(r, key, by)).map(r => r.convId);
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
  const taken = columns.find(c => columnEditable(c.key) && c.label.toLowerCase() === key)?.label;
  return taken === undefined ? null : `A column named ${taken} already exists.`;
}

export function addedColumnOrder(
  shown: readonly string[], saved: readonly string[], name: string, by: EditableColumnBy = 'label',
): string[] {
  return [...withShown(saved, shown), columnKeyOf(by, typedName(name))];
}

export function renameTarget(
  columns: readonly BoardColumn<unknown>[], from: string, name: string,
): { name: string; merge: boolean } {
  const typed = typedName(name);
  const key = typed.toLowerCase();
  const existing = key === from.toLowerCase() ? null : columns.find(c => columnEditable(c.key) && c.label.toLowerCase() === key)?.label;
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
  shown: readonly string[], saved: readonly string[], from: string, to: string, by: EditableColumnBy = 'label',
): string[] {
  const fromKey = columnKeyOf(by, from).toLowerCase();
  const toKey = columnKeyOf(by, to);
  const full = withShown(saved, shown);
  const merging = full.some(key => key.toLowerCase() === toKey.toLowerCase() && key.toLowerCase() !== fromKey);
  return full.flatMap((key) => {
    if (key.toLowerCase() !== fromKey) return [key];
    return merging ? [] : [toKey];
  });
}

export function deletedColumnOrder(
  shown: readonly string[], saved: readonly string[], label: string, by: EditableColumnBy = 'label',
): string[] {
  const key = columnKeyOf(by, label).toLowerCase();
  return withShown(saved, shown).filter(k => k.toLowerCase() !== key);
}

export function deleteColumnConfirm(
  label: string, carriers: number, by: EditableColumnBy = 'label',
): { title: string; message: string } {
  const channels = carriers === 1 ? '1 channel' : `${carriers} channels`;
  const noun = columnNoun(by);
  const moved = by === 'label' ? 'Channels with no other label leave the board.' : `They move to ${NO_GROUP_TITLES[by]}. Labels are kept.`;
  return {
    title: 'Delete column',
    message: carriers === 0
      ? `No channel has the ${label} ${noun}.`
      : `This removes the ${label} ${noun} from ${channels}. ${moved}`,
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

export function cardsRightPadding(padding: number, gutter: number): number {
  return Math.max(0, padding - gutter);
}

export type BoardCardPress = 'push' | 'replace' | 'close';

export function boardCardPress(openConvId: string | null, convId: string): BoardCardPress {
  if (openConvId === null) return 'push';
  return openConvId === convId ? 'close' : 'replace';
}
