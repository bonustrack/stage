import { filterChannelRows, sortChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import type { ConversationView } from '../../modules/messaging';
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

interface ChannelsOverflowItem {
  id: string;
  label: string;
  icon: string;
}

export const CHANNELS_OVERFLOW_ITEMS: ChannelsOverflowItem[] = [
  { id: 'board', label: 'Board view', icon: 'viewBoards' },
  { id: 'copy-address', label: 'Copy address', icon: 'copy' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'cog' },
];

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
