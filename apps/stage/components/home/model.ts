import type { ConversationView } from '../../lib/messaging/conversation';
import type { MenuItem } from '../appIcons';
import { COPY_ADDRESS_ITEM } from '../profile/ProfileScreen.model';
import { orderedColumns } from './board/BoardScreen.model';
import { groupKeyOf } from '../../lib/grouping.model';

export type Row = ConversationView & Record<string, unknown>;

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

export type HomeOverflowId = 'copy-address' | 'profile' | 'settings';

export const CHANNELS_OVERFLOW_ITEMS: MenuItem<HomeOverflowId>[] = [
  COPY_ADDRESS_ITEM,
  { id: 'profile', label: 'Profile', icon: 'IconPeople' },
  { id: 'settings', label: 'Settings', icon: 'IconSettingsGear2' },
];

export function searchBarLabels(matching: string[], enabled: ReadonlySet<string>, boardOrder: readonly string[]): string[] {
  const keys = new Set(matching.map((l) => l.toLowerCase()));
  const kept = [...enabled].filter((l) => !keys.has(l.toLowerCase()));
  const labels = [...matching, ...kept].sort((a, b) => a.localeCompare(b));
  return orderedColumns(
    labels.map((label) => ({ key: groupKeyOf('label', label), label })),
    boardOrder,
  ).map((c) => c.label);
}
