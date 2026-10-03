import { categoryOf } from '@stage-labs/client/xmtp/labels';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';

export interface GroupableRow {
  peerAddress?: string | null;
  labels?: string[];
  category?: string | null;
  assigned?: string[];
}

export type NameOf = (address: string) => string;

export const GROUP_BY_LABELS: Record<GroupKey, string> = { assignee: 'Assignees', category: 'Category', label: 'Label' };

export const NO_GROUP_TITLES: Record<GroupKey, string> = { assignee: 'Unassigned', category: 'No category', label: 'No label' };

export function groupValuesOf(row: GroupableRow, by: GroupKey): string[] {
  if (by === 'label') return row.labels ?? [];
  if (by === 'assignee') return row.assigned ?? [];
  const category = categoryOf(row.category);
  return category === null ? [] : [category];
}

export function groupTitleOf(by: GroupKey, value: string, nameOf: NameOf): string {
  return by === 'assignee' ? nameOf(value) : value;
}
