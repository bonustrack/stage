import {
  GROUP_KEYS,
  homeSortSchema,
  homeViewSchema,
  type HomeSort,
  type HomeViewContent,
  type HomeViewEdit,
} from '@stage-labs/client/xmtp/sync/homeView';
import type { AppIconName } from '../appIcons';
import { groupByLabel } from './groupBy.model';
import { homeSortOf, SORT_LABELS } from './sort.model';
import { lastActivityLabel } from './activity.model';
import { GROUPING_FIELDS } from '../../lib/grouping.model';
import { LAST_ACTIVITY_WINDOWS, type LastActivity } from '../../lib/lastActivity.model';

export type ViewMenuPage = 'view' | 'layout' | 'grouping' | 'sorting' | 'filter' | 'fields' | 'activity';

export type ViewMenuAction =
  { kind: 'page'; page: ViewMenuPage } | { kind: 'edit'; edit: HomeViewEdit } | { kind: 'activity'; window: LastActivity };

export interface ViewMenuRow {
  id: string;
  label: string;
  value?: string;
  icon?: AppIconName;
  selected: boolean;
  action: ViewMenuAction;
}

export interface ViewMenuSection {
  heading?: string;
  rows: ViewMenuRow[];
}

export type ViewMenuPicker = 'radio' | 'checkbox' | null;

export interface ViewMenuContent {
  sections: ViewMenuSection[];
  picker: ViewMenuPicker;
  back: ViewMenuPage | null;
}

const SORT_ICONS: Record<HomeSort['by'], AppIconName> = {
  status: GROUPING_FIELDS.status.icon,
  created: 'IconCalendar1',
  updated: 'IconClock',
  priority: GROUPING_FIELDS.priority.icon,
};
const DIRECTION_ICONS: Record<HomeSort['direction'], AppIconName> = { asc: 'IconArrowUp', desc: 'IconArrowDown' };

const edit = (change: HomeViewEdit): ViewMenuAction => ({ kind: 'edit', edit: change });

function sortEdit(current: HomeViewContent, change: Partial<HomeSort>): ViewMenuAction {
  return edit({ [current.view === 'board' ? 'boardSort' : 'chatsSort']: { ...homeSortOf(current), ...change } });
}

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
        action: sortEdit(current, { by }),
      })),
    },
    {
      heading: 'Direction',
      rows: homeSortSchema.shape.direction.options.map((direction) => ({
        id: `direction:${direction}`,
        label: direction === 'asc' ? 'Ascending' : 'Descending',
        icon: DIRECTION_ICONS[direction],
        selected: sort.direction === direction,
        action: sortEdit(current, { direction }),
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
        action: { kind: 'activity', window },
      })),
    },
  ];
}

function pageRow(id: ViewMenuPage, label: string, icon: AppIconName, value?: string): ViewMenuRow {
  return { id, label, value, icon, selected: false, action: { kind: 'page', page: id } };
}

function rootRows(current: HomeViewContent): ViewMenuRow[] {
  const board = current.view === 'board';
  const sort = homeSortOf(current);
  const picked = board ? current.columnBy : current.groupBy;
  return [
    pageRow('layout', 'View', board ? 'IconColumns3Wide' : 'IconBubble3', board ? 'Board' : 'Chats'),
    pageRow('grouping', board ? 'Column by' : 'Group by', 'IconLayersThree', picked === 'none' ? 'No grouping' : groupByLabel(picked)),
    pageRow('sorting', 'Sort by', DIRECTION_ICONS[sort.direction], SORT_LABELS[sort.by]),
    pageRow('filter', 'Filter', 'IconFilter1'),
    pageRow('fields', 'Fields', 'IconEyeOpen'),
  ];
}

export function homeViewMenu(current: HomeViewContent, grouping = false): ViewMenuSection[] {
  if (!grouping) return [{ rows: rootRows(current) }];
  const board = current.view === 'board';
  const picked = board ? current.columnBy : current.groupBy;
  const groups = GROUP_KEYS.map((key): ViewMenuRow => ({
    id: `group:${key}`,
    label: groupByLabel(key),
    icon: GROUPING_FIELDS[key].icon,
    selected: picked === key,
    action: edit(board ? { columnBy: key } : { groupBy: key }),
  }));
  if (!board) groups.push({ id: 'group:none', label: 'No grouping', selected: picked === 'none', action: edit({ groupBy: 'none' }) });
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
        action: edit({ view }),
      })),
    },
  ];
}

export function viewMenuContent(at: ViewMenuPage, current: HomeViewContent, activity: LastActivity): ViewMenuContent {
  if (at === 'activity') return { sections: homeActivityMenu(activity), picker: 'radio', back: 'filter' };
  if (at === 'layout') return { sections: homeLayoutMenu(current), picker: 'radio', back: 'view' };
  if (at === 'sorting') return { sections: homeSortMenu(current), picker: 'checkbox', back: 'view' };
  return { sections: homeViewMenu(current, at === 'grouping'), picker: null, back: at === 'view' ? null : 'view' };
}
