import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { CHANNEL_PRIORITIES, categoryOf, priorityOf } from '@stage-labs/client/xmtp/labels';
import { savedFirst } from '@stage-labs/client/xmtp/pinOrder';
import { homeSortSchema, type HomeSort, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/readState';
import { compareNames } from '../../lib/format';

const DEFAULT_SORT: Record<HomeViewContent['view'], HomeSort> = {
  chats: { by: 'updated', direction: 'desc' },
  board: { by: 'priority', direction: 'desc' },
};

export const SORT_LABELS: Record<HomeSort['by'], string> = {
  status: 'Status', created: 'Created', updated: 'Updated', priority: 'Priority',
};

export function homeSortOf(view: HomeViewContent): HomeSort {
  return (view.view === 'board' ? view.boardSort : view.chatsSort) ?? DEFAULT_SORT[view.view];
}

export function homeSortEdit(view: HomeViewContent, id: string): HomeViewEdit | null {
  const current = homeSortOf(view);
  const by = homeSortSchema.shape.by.safeParse(id.slice('sort:'.length));
  const direction = homeSortSchema.shape.direction.safeParse(id.slice('direction:'.length));
  const sort = id.startsWith('sort:') && by.success ? { ...current, by: by.data }
    : id.startsWith('direction:') && direction.success ? { ...current, direction: direction.data } : null;
  return sort === null ? null : { [view.view === 'board' ? 'boardSort' : 'chatsSort']: sort };
}

interface SortableRow extends ChannelListRow {
  createdTs?: number | null;
  status?: string | null;
  priority?: string | null;
}

const timestamp = (value: number | null | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
);

function statusRanks(rows: readonly SortableRow[], order: readonly string[]): Map<string, number> {
  const statuses = [...new Set(rows.flatMap(row => {
    const status = categoryOf(row.status);
    return status === null ? [] : [status.toLowerCase()];
  }))];
  const saved = order.filter(key => key.startsWith('status:')).map(key => key.slice('status:'.length).toLowerCase());
  const compare = (a: string, b: string): number => compareNames(a, b) || (a < b ? -1 : a > b ? 1 : 0);
  return new Map(savedFirst(statuses, saved, value => value, compare).map((status, index) => [status, index]));
}

function valueOf(row: SortableRow, by: HomeSort['by'], statuses: ReadonlyMap<string, number>): number | null {
  if (by === 'created') return timestamp(row.createdTs);
  if (by === 'updated') return timestamp(row.lastTs) ?? timestamp(row.createdTs);
  if (by === 'status') return statuses.get(categoryOf(row.status)?.toLowerCase() ?? '') ?? null;
  const priority = priorityOf(row.priority);
  return priority === null ? null : CHANNEL_PRIORITIES.length - CHANNEL_PRIORITIES.indexOf(priority);
}

function compareValues(a: number | null, b: number | null, direction: HomeSort['direction']): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

export function sortHomeRows<T extends SortableRow>(
  rows: T[], pinned: readonly string[], sort: HomeSort = DEFAULT_SORT.chats, statusOrder: readonly string[] = [],
): T[] {
  const statuses = sort.by === 'status' ? statusRanks(rows, statusOrder) : new Map<string, number>();
  return savedFirst(rows, pinned, row => row.convId, (a, b) => (
    compareValues(valueOf(a, sort.by, statuses), valueOf(b, sort.by, statuses), sort.direction)
    || compareValues(timestamp(a.lastTs), timestamp(b.lastTs), 'desc')
    || a.convId.localeCompare(b.convId)
  ));
}
