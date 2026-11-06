import type { ConversationView } from '../../lib/messaging/conversation';
import {
  GROUP_KEYS,
  homeSortSchema,
  homeViewSchema,
  type HomeSort,
  type HomeViewContent,
  type HomeViewEdit,
} from '@stage-labs/client/xmtp/sync/homeView';
import type { AppIconName, MenuItem } from '../appIcons';
import { COPY_ADDRESS_ITEM } from '../profile/ProfileScreen.model';
import { groupByLabel } from './groupBy.model';
import { homeSortEdit, homeSortOf, SORT_LABELS } from './sort.model';
import { orderedColumns } from './board/BoardScreen.model';
import { GROUPING_FIELDS, groupKeyOf } from '../../lib/grouping.model';
import { lastActivityLabel } from './activity.model';
import { LAST_ACTIVITY_WINDOWS, type LastActivity } from '../../lib/lastActivity.model';

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
    ...m.barLabels.map((label) => ({ value: label, label, selected: m.enabledLabels.has(label.toLowerCase()) })),
  ];
}

interface ChannelsFilterHandlers {
  onClearAll: () => void;
  onToggleUnread: () => void;
  onToggleLabel: (label: string) => void;
}

export function selectChannelsFilter(h: ChannelsFilterHandlers, value: string): void {
  if (value === '') {
    h.onClearAll();
    return;
  }
  if (value === UNREAD_FILTER_VALUE) {
    h.onToggleUnread();
    return;
  }
  h.onToggleLabel(value);
}

export const CHANNELS_OVERFLOW_ITEMS: MenuItem[] = [
  COPY_ADDRESS_ITEM,
  { id: 'profile', label: 'Profile', icon: 'IconPeople' },
  { id: 'settings', label: 'Settings', icon: 'IconSettingsGear2' },
];

export interface ViewMenuRow {
  id: string;
  label: string;
  value?: string;
  icon?: AppIconName;
  selected: boolean;
}

export interface ViewMenuSection {
  heading?: string;
  rows: ViewMenuRow[];
}

const GROUP_ID_PREFIX = 'group:';
const SORT_ICONS: Record<HomeSort['by'], AppIconName> = {
  status: GROUPING_FIELDS.status.icon,
  created: 'IconCalendar1',
  updated: 'IconClock',
  priority: GROUPING_FIELDS.priority.icon,
};
const DIRECTION_ICONS: Record<HomeSort['direction'], AppIconName> = { asc: 'IconArrowUp', desc: 'IconArrowDown' };

export function homeSortMenu(current: HomeViewContent): ViewMenuSection[] {
  const sort = homeSortOf(current);
  return [
    {
      heading: 'Sort by',
      rows: homeSortSchema.shape.by.options.map((by) => ({
        id: `sort:${by}`,
        label: SORT_LABELS[by],
        icon: SORT_ICONS[by],
        selected: sort.by === by,
      })),
    },
    {
      heading: 'Direction',
      rows: homeSortSchema.shape.direction.options.map((direction) => ({
        id: `direction:${direction}`,
        label: direction === 'asc' ? 'Ascending' : 'Descending',
        icon: DIRECTION_ICONS[direction],
        selected: sort.direction === direction,
      })),
    },
  ];
}

export function homeActivityMenu(current: LastActivity): ViewMenuSection[] {
  return [
    {
      heading: 'Last activity',
      rows: LAST_ACTIVITY_WINDOWS.map((window) => ({
        id: `activity:${window}`,
        label: lastActivityLabel(window),
        selected: current === window,
      })),
    },
  ];
}

export function homeViewMenu(current: HomeViewContent, grouping = false): ViewMenuSection[] {
  const board = current.view === 'board';
  const sort = homeSortOf(current);
  const picked = board ? current.columnBy : current.groupBy;
  if (!grouping)
    return [
      {
        rows: [
          {
            id: 'layout',
            label: 'View',
            value: board ? 'Board' : 'Chats',
            icon: board ? 'IconColumns3Wide' : 'IconBubble3',
            selected: false,
          },
          {
            id: 'grouping',
            label: board ? 'Column by' : 'Group by',
            value: picked === 'none' ? 'No grouping' : groupByLabel(picked),
            icon: 'IconLayersThree',
            selected: false,
          },
          { id: 'sorting', label: 'Sort by', value: SORT_LABELS[sort.by], icon: DIRECTION_ICONS[sort.direction], selected: false },
          { id: 'filter', label: 'Filter', icon: 'IconFilter1', selected: false },
          { id: 'fields', label: 'Fields', icon: 'IconEyeOpen', selected: false },
        ],
      },
    ];
  const groups = GROUP_KEYS.map((key): ViewMenuRow => ({
    id: GROUP_ID_PREFIX + key,
    label: groupByLabel(key),
    icon: GROUPING_FIELDS[key].icon,
    selected: picked === key,
  }));
  if (!board) groups.push({ id: `${GROUP_ID_PREFIX}none`, label: 'No grouping', selected: picked === 'none' });
  return [{ heading: board ? 'Column by' : 'Group by', rows: groups }];
}

export function homeLayoutMenu(current: HomeViewContent): ViewMenuSection[] {
  return [
    {
      heading: 'View',
      rows: homeViewSchema.shape.view.options.map((view) => ({
        id: `view:${view}`,
        label: view === 'board' ? 'Board' : 'Chats',
        icon: view === 'board' ? 'IconColumns3Wide' : 'IconBubble3',
        selected: current.view === view,
      })),
    },
  ];
}

export function homeViewEdit(current: HomeViewContent, id: string): HomeViewEdit | null {
  if (id.startsWith('view:')) {
    const view = homeViewSchema.shape.view.safeParse(id.slice('view:'.length));
    return view.success ? { view: view.data } : null;
  }
  if (!id.startsWith(GROUP_ID_PREFIX)) return homeSortEdit(current, id);
  const value = id.slice(GROUP_ID_PREFIX.length);
  if (current.view === 'board') {
    const column = homeViewSchema.shape.columnBy.safeParse(value);
    return column.success ? { columnBy: column.data } : null;
  }
  const group = homeViewSchema.shape.groupBy.safeParse(value);
  return group.success ? { groupBy: group.data } : null;
}

export function searchBarLabels(matching: string[], enabled: ReadonlySet<string>, boardOrder: readonly string[]): string[] {
  const keys = new Set(matching.map((l) => l.toLowerCase()));
  const kept = [...enabled].filter((l) => !keys.has(l.toLowerCase()));
  const labels = [...matching, ...kept].sort((a, b) => a.localeCompare(b));
  return orderedColumns(
    labels.map((label) => ({ key: groupKeyOf('label', label), label })),
    boardOrder,
  ).map((c) => c.label);
}
