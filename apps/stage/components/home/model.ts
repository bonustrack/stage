import { filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import type { ConversationView } from '../../modules/messaging/conversation';
import {
  GROUP_KEYS, homeSortSchema, homeViewSchema, type GroupKey, type HomeSort, type HomeViewContent, type HomeViewEdit,
} from '@stage-labs/client/xmtp/readState';
import type { AppIconName, MenuItem } from '../appIcons';
import { COPY_ADDRESS_ITEM } from '../ProfileScreen.model';
import { GROUP_BY_LABELS } from './groupBy.model';
import { homeSortEdit, homeSortOf, SORT_LABELS, sortHomeRows } from './sort.model';
import { labelColumnKey, orderedColumns } from '../board/BoardScreen.model';

export const NO_MESSAGES_PREVIEW = '(no messages yet)';
export type Row = ConversationView & Record<string, unknown>;

const SELF_PREVIEW_PREFIX = 'You: ';

interface RowPreviewModel {
  preview: string | null | undefined;
  dm: boolean;
  fromSelf: boolean;
  senderLabel: string | null;
}

export function rowPreviewText(m: RowPreviewModel): string {
  if (!m.preview) return NO_MESSAGES_PREVIEW;
  if (m.fromSelf) return `${SELF_PREVIEW_PREFIX}${m.preview}`;
  if (m.dm || m.senderLabel === null) return m.preview;
  return `${m.senderLabel}: ${m.preview}`;
}

interface LabelBarChip {
  value: string;
  label: string;
  selected?: boolean;
}

const UNREAD_FILTER_VALUE = '__unread__';

interface ChannelsFilterModel {
  barLabels: string[];
  enabledLabels: ReadonlySet<string>;
  unreadOnly: boolean;
}

export function channelsLabelChips(m: ChannelsFilterModel): LabelBarChip[] {
  const allSelected = !m.unreadOnly && m.enabledLabels.size === 0;
  return [
    { value: '', label: 'All', selected: allSelected },
    { value: UNREAD_FILTER_VALUE, label: 'Unread', selected: m.unreadOnly },
    ...m.barLabels.map(label => ({
      value: label,
      label,
      selected: m.enabledLabels.has(label.toLowerCase()),
    })),
  ];
}

interface ChannelsFilterHandlers {
  onClearAll: () => void;
  onToggleUnread: () => void;
  onToggleLabel: (label: string) => void;
}

export function selectChannelsFilter(h: ChannelsFilterHandlers, value: string): void {
  if (value === '') { h.onClearAll(); return; }
  if (value === UNREAD_FILTER_VALUE) { h.onToggleUnread(); return; }
  h.onToggleLabel(value);
}

export const VIEW_ITEM = 'view';

export const CHANNELS_OVERFLOW_ITEMS: MenuItem[] = [
  { id: VIEW_ITEM, label: 'View', icon: 'IconEyeOpen' },
  COPY_ADDRESS_ITEM,
  { id: 'profile', label: 'Profile', icon: 'IconPeople' },
  { id: 'settings', label: 'Settings', icon: 'IconSettingsGear2' },
];

export interface ViewMenuRow {
  id: string;
  label: string;
  icon?: AppIconName;
  selected: boolean;
}

export interface ViewMenuSection {
  heading?: string;
  rows: ViewMenuRow[];
}

const VIEW_ID_PREFIX = 'view:';
const GROUP_ID_PREFIX = 'group:';
const GROUP_ICONS: Record<GroupKey, AppIconName> = {
  assignee: 'IconPeopleAdded', category: 'IconFolder1', label: 'IconTag', status: 'IconCircleDashed',
};

const SORT_ICONS: Record<HomeSort['by'], AppIconName> = {
  status: 'IconCircleDashed', created: 'IconCalendar1', updated: 'IconClock', priority: 'IconFlag1',
};
const DIRECTION_ICONS: Record<HomeSort['direction'], AppIconName> = { asc: 'IconArrowUp', desc: 'IconArrowDown' };

export function homeSortMenu(current: HomeViewContent): ViewMenuSection[] {
  const sort = homeSortOf(current);
  return [
    { heading: 'Sort by', rows: homeSortSchema.shape.by.options.map(by => ({
      id: `sort:${by}`, label: SORT_LABELS[by], icon: SORT_ICONS[by], selected: sort.by === by,
    })) },
    { heading: 'Direction', rows: homeSortSchema.shape.direction.options.map(direction => ({
      id: `direction:${direction}`, label: direction === 'asc' ? 'Ascending' : 'Descending',
      icon: DIRECTION_ICONS[direction], selected: sort.direction === direction,
    })) },
  ];
}

export function homeViewMenu(current: HomeViewContent, grouping = false): ViewMenuSection[] {
  const board = current.view === 'board';
  const sort = homeSortOf(current);
  if (!grouping) return [
    { rows: [
      { id: `${VIEW_ID_PREFIX}chats`, label: 'Chats', icon: 'IconBubble3', selected: !board },
      { id: `${VIEW_ID_PREFIX}board`, label: 'Board', icon: 'IconColumns3Wide', selected: board },
    ] },
    { rows: [
      { id: 'grouping', label: board ? 'Column by' : 'Group by', icon: 'IconLayersThree', selected: false },
      { id: 'sorting', label: `Sort by: ${SORT_LABELS[sort.by]}`, icon: DIRECTION_ICONS[sort.direction], selected: false },
      { id: 'filter', label: 'Filter', icon: 'IconFilter1', selected: false },
      { id: 'fields', label: 'Fields', icon: 'IconEyeOpen', selected: false },
    ] },
  ];
  const picked = board ? current.columnBy : current.groupBy;
  const groups = GROUP_KEYS.map((key): ViewMenuRow => (
    { id: GROUP_ID_PREFIX + key, label: GROUP_BY_LABELS[key], icon: GROUP_ICONS[key], selected: picked === key }
  ));
  if (!board) groups.push({ id: `${GROUP_ID_PREFIX}none`, label: 'No grouping', selected: picked === 'none' });
  return [{ heading: board ? 'Column by' : 'Group by', rows: groups }];
}

export function homeViewEdit(current: HomeViewContent, id: string): HomeViewEdit | null {
  const view = homeViewSchema.shape.view.safeParse(id.slice(VIEW_ID_PREFIX.length));
  if (id.startsWith(VIEW_ID_PREFIX) && view.success) return { view: view.data };
  if (!id.startsWith(GROUP_ID_PREFIX)) return homeSortEdit(current, id);
  const value = id.slice(GROUP_ID_PREFIX.length);
  if (current.view === 'board') {
    const column = homeViewSchema.shape.columnBy.safeParse(value);
    return column.success ? { columnBy: column.data } : null;
  }
  const group = homeViewSchema.shape.groupBy.safeParse(value);
  return group.success ? { groupBy: group.data } : null;
}

interface SortInputs {
  rows: Row[] | null;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: readonly string[];
  sort?: HomeSort;
  statusOrder?: readonly string[];
}

export function deriveSortedRows(i: SortInputs): Row[] {
  const filtered = filterChannelRows(i.rows ?? [], {
    enabledLabels: i.enabledLabels,
    unreadOnly: i.unreadOnly,
  });
  return sortHomeRows(filtered, i.pinned, i.sort, i.statusOrder);
}

export function searchBarLabels(
  matching: string[], enabled: ReadonlySet<string>, boardOrder: readonly string[],
): string[] {
  const keys = new Set(matching.map(l => l.toLowerCase()));
  const kept = [...enabled].filter(l => !keys.has(l.toLowerCase()));
  const labels = [...matching, ...kept].sort((a, b) => a.localeCompare(b));
  return orderedColumns(labels.map(label => ({ key: labelColumnKey(label), label })), boardOrder).map(c => c.label);
}

export function mergePaintedRows<R extends { convId: string; lastTs: number | null }>(
  beforeIds: readonly string[], current: readonly R[] | null, painted: readonly R[],
): R[] {
  const before = new Set(beforeIds);
  const now = new Set((current ?? []).map(r => r.convId));
  const paintedIds = new Set(painted.map(r => r.convId));
  const addedMeanwhile = (current ?? []).filter(r => !before.has(r.convId) && !paintedIds.has(r.convId));
  const kept = painted.filter(r => now.has(r.convId) || !before.has(r.convId));
  return [...addedMeanwhile, ...kept].sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
}

export function visibleRowsDiff(rowIds: readonly string[], visibleIds: readonly string[]): { added: string[]; gone: string[] } {
  const rows = new Set(rowIds);
  const visible = new Set(visibleIds);
  return {
    added: visibleIds.filter(id => !rows.has(id)),
    gone: rowIds.filter(id => !visible.has(id)),
  };
}
