import { filterChannelRows, sortChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import type { ConversationView } from '../../modules/messaging';
import type { MenuItem } from '../appIcons';
import { COPY_ADDRESS_ITEM } from '../ProfileScreen.model';
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

interface ChannelsFilterBarModel {
  labelCount: number;
  unreadOnly: boolean;
  enabledLabelsCount: number;
}

export function channelsFilterBarVisible(m: ChannelsFilterBarModel): boolean {
  return m.labelCount > 0 || m.unreadOnly || m.enabledLabelsCount > 0;
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

export const GROUP_BY_CATEGORY_ITEM = 'group-by-category';

const CHANNELS_OVERFLOW_ITEMS: MenuItem[] = [
  { id: 'board', label: 'Board view', icon: 'IconColumns3Wide' },
  { id: 'chats', label: 'Chats view', icon: 'IconBubble3' },
  { id: GROUP_BY_CATEGORY_ITEM, label: 'Group by category', icon: 'IconFolder1' },
  COPY_ADDRESS_ITEM,
  { id: 'profile', label: 'Profile', icon: 'IconPeople' },
  { id: 'settings', label: 'Settings', icon: 'IconSettingsGear2' },
];

export function channelsOverflowItems(groupedByCategory: boolean): MenuItem[] {
  return CHANNELS_OVERFLOW_ITEMS.map(item => (item.id === GROUP_BY_CATEGORY_ITEM ? { ...item, selected: groupedByCategory } : item));
}

interface SortInputs {
  rows: Row[] | null;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: readonly string[];
}

export function deriveSortedRows(i: SortInputs): Row[] {
  const filtered = filterChannelRows(i.rows ?? [], {
    enabledLabels: i.enabledLabels,
    unreadOnly: i.unreadOnly,
  });
  return sortChannelRows(filtered, i.pinned);
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
