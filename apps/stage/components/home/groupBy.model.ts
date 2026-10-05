import { categoryOf } from '@stage-labs/client/xmtp/labels';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';

export interface GroupableRow {
  peerAddress?: string | null;
  labels?: string[];
  category?: string | null;
  status?: string | null;
  assigned?: string[];
}

export type NameOf = (address: string) => string;

export const GROUP_BY_LABELS: Record<GroupKey, string> = {
  assignee: 'Assignees', category: 'Category', label: 'Label', status: 'Status',
};

export const NO_GROUP_TITLES: Record<GroupKey, string> = {
  assignee: 'Unassigned', category: 'No category', label: 'No label', status: 'No status',
};

export function groupValuesOf(row: GroupableRow, by: GroupKey): string[] {
  if (by === 'label') return row.labels ?? [];
  if (by === 'assignee') return row.assigned ?? [];
  const value = categoryOf(row[by]);
  return value === null ? [] : [value];
}

export function groupTitleOf(by: GroupKey, value: string, nameOf: NameOf): string {
  return by === 'assignee' ? nameOf(value) : value;
}

export interface Bucket<R> {
  key: string;
  title: string;
  rows: R[];
}

export function bucketRows<R extends GroupableRow>(
  rows: readonly R[], by: GroupKey, nameOf: NameOf, keyOf: (value: string) => string,
): { buckets: Bucket<R>[]; none: R[] } {
  const buckets = new Map<string, Bucket<R>>();
  const none: R[] = [];
  for (const row of rows) {
    const values = groupValuesOf(row, by);
    if (values.length === 0) none.push(row);
    for (const value of values) {
      const bucket = buckets.get(value.toLowerCase()) ?? { key: keyOf(value), title: groupTitleOf(by, value, nameOf), rows: [] };
      buckets.set(value.toLowerCase(), bucket);
      bucket.rows.push(row);
    }
  }
  return { buckets: [...buckets.values()], none };
}
