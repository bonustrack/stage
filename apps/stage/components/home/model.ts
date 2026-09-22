export const NO_MESSAGES_PREVIEW = '(no messages yet)';
export const SELF_PREVIEW_PREFIX = 'You: ';

export interface RowPreviewModel {
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

export interface LabelBarChip {
  value: string;
  label: string;
  selected?: boolean;
}

export const UNREAD_FILTER_VALUE = '__unread__';

export interface ChannelsFilterModel {
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

export interface ChannelsFilterBarModel {
  labelCount: number;
  unreadOnly: boolean;
  enabledLabelsCount: number;
}

export function channelsFilterBarVisible(m: ChannelsFilterBarModel): boolean {
  return m.labelCount > 0 || m.unreadOnly || m.enabledLabelsCount > 0;
}

export interface ChannelsFilterHandlers {
  onClearAll: () => void;
  onToggleUnread: () => void;
  onToggleLabel: (label: string) => void;
}

export function selectChannelsFilter(h: ChannelsFilterHandlers, value: string): void {
  if (value === '') { h.onClearAll(); return; }
  if (value === UNREAD_FILTER_VALUE) { h.onToggleUnread(); return; }
  h.onToggleLabel(value);
}

export interface ChannelsOverflowItem {
  id: string;
  label: string;
  icon: string;
}

export function channelsOverflowItems(features: { copyAddress?: boolean } = {}): ChannelsOverflowItem[] {
  const items: ChannelsOverflowItem[] = [
    { id: 'new', label: 'New group', icon: 'plus' },
  ];
  if (features.copyAddress === true) {
    items.push({ id: 'copy-address', label: 'Copy address', icon: 'copy' });
  }
  items.push(
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'settings', label: 'Settings', icon: 'cog' },
  );
  return items;
}
