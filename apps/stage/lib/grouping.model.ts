import { CHANNEL_FIELD_NOUNS, type ChannelField } from '@stage-labs/client/xmtp/channelMeta';
import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';

export type GroupingField = GroupKey | ChannelField;

export const DM_SECTION = 'dm';
export const NO_SECTION = 'none';

const HEADER_ID_PREFIX = 'group:';

const prefixOf = (by: GroupingField): string => `${by}:`;

export function groupKeyOf(by: GroupingField, value: string): string {
  return `${prefixOf(by)}${value}`;
}

export function sectionKeyOf(by: GroupKey, value: string): string {
  return groupKeyOf(by, value.toLowerCase());
}

export function isGroupKeyOf(by: GroupingField, key: string): boolean {
  return key.startsWith(prefixOf(by));
}

export function groupValueOf(by: GroupingField, key: string): string | null {
  return isGroupKeyOf(by, key) ? key.slice(prefixOf(by).length) : null;
}

export function isNamedGroupKey(by: GroupingField, key: string): boolean {
  const value = groupValueOf(by, key);
  return value !== null && value !== '';
}

export function groupHeaderId(sectionKey: string): string {
  return `${HEADER_ID_PREFIX}${sectionKey}`;
}

export type GroupingOrderStore = 'categories' | 'board';

export interface GroupingOrders {
  categories: readonly string[];
  board: readonly string[];
}

export function groupingOrderStore(by: GroupKey): GroupingOrderStore {
  return by === 'category' ? 'categories' : 'board';
}

export function groupingOrderOf(by: GroupKey, orders: GroupingOrders): readonly string[] {
  return orders[groupingOrderStore(by)];
}

export const GROUPING_FIELDS = {
  assignee: { label: 'Assignees', noun: 'assignee', unset: 'Unassigned', icon: 'IconPeopleAdded' },
  category: { label: 'Project', noun: CHANNEL_FIELD_NOUNS.category, unset: 'No project', icon: 'IconFolder1' },
  label: { label: 'Label', noun: 'label', unset: 'No label', icon: 'IconTag' },
  status: { label: 'Status', noun: CHANNEL_FIELD_NOUNS.status, unset: 'No status', icon: 'IconCircleDashed' },
  priority: { label: 'Priority', noun: CHANNEL_FIELD_NOUNS.priority, icon: 'IconFlag1' },
} as const satisfies Record<GroupingField, { label: string; noun: string; unset?: string; icon: string }>;
