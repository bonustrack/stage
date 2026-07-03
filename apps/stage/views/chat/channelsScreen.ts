import type { Color, PayloadHandlers, WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { LABEL_CHIP_PRESS } from '../actions';
import { labelBar, type LabelBarChip } from './labelBar';

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

export interface LabelBarColors {
  selectedBackground: Color;
  selectedLabelColor: Color;
  restBackground: Color;
  restLabelColor: Color;
}

export function channelsLabelBarNode(
  m: ChannelsFilterModel,
  colors: LabelBarColors,
): WidgetRoot {
  return basicRoot(labelBar({ chips: channelsLabelChips(m), ...colors }));
}

export interface ChannelsFilterHandlers {
  onClearAll: () => void;
  onToggleUnread: () => void;
  onToggleLabel: (label: string) => void;
}

export function channelsLabelBarActions(h: ChannelsFilterHandlers): PayloadHandlers {
  return {
    [LABEL_CHIP_PRESS]: (payload): void => {
      const value = payload.value;
      if (typeof value !== 'string') return;
      if (value === '') { h.onClearAll(); return; }
      if (value === UNREAD_FILTER_VALUE) { h.onToggleUnread(); return; }
      h.onToggleLabel(value);
    },
  };
}

export interface ChannelsOverflowItem {
  id: string;
  label: string;
  icon: string;
}

export function channelsOverflowItems(features: { copyAddress?: boolean } = {}): ChannelsOverflowItem[] {
  const items: ChannelsOverflowItem[] = [
    { id: 'new', label: 'New group', icon: 'plus' },
    { id: 'archived', label: 'Archived', icon: 'archive' },
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
