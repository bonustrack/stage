import { CHANNEL_FIELDS, type ChannelFields, type ChannelField } from './home/fields.model';
import type { AppIconName } from './appIcons';

export interface ChannelRowFieldData {
  peerAddress?: string | null;
  inboxToAddr?: Record<string, string>;
  assigned?: string[];
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  labels?: string[];
}

interface VisibleChannelField {
  id: ChannelField;
  label: string;
  icon?: AppIconName;
  value: string;
  addresses: string[];
  labels?: string[];
}

const MAX_VISIBLE_LABELS = 2;

function visibleLabels(labels: string[] = []): string[] {
  const shown = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflow = labels.length - shown.length;
  return overflow > 0 ? [...shown, `+${overflow}`] : shown;
}

function uniqueAddresses(addresses: string[]): string[] {
  return [...new Set(addresses.map(address => address.trim().toLowerCase()).filter(Boolean))];
}

function peopleAddresses(data: ChannelRowFieldData, field: 'members' | 'assignees'): string[] {
  const members = uniqueAddresses(Object.values(data.inboxToAddr ?? {}));
  if (field === 'members') return members;
  const assigned = new Set((data.assigned ?? []).map(address => address.toLowerCase()));
  return members.filter(address => assigned.has(address));
}

function metadataText(data: ChannelRowFieldData, field: 'category' | 'status' | 'priority'): string {
  return data[field]?.trim() ?? '';
}

export function visibleChannelFields(data: ChannelRowFieldData, fields: ChannelFields): VisibleChannelField[] {
  if (data.peerAddress) return [];
  return CHANNEL_FIELDS.flatMap((field): VisibleChannelField[] => {
    if (!fields[field.id] || field.id === 'avatar' || field.id === 'lastMessage') return [];
    if (field.id === 'labels') {
      const labels = visibleLabels(data.labels);
      return labels.length === 0 ? [] : [{ id: field.id, label: field.label, value: '', addresses: [], labels }];
    }
    if (field.id === 'members' || field.id === 'assignees') {
      const addresses = peopleAddresses(data, field.id);
      return addresses.length === 0 ? [] : [{ id: field.id, label: field.label, value: '', addresses }];
    }
    const value = metadataText(data, field.id);
    return value === '' ? [] : [{ ...field, value, addresses: [] }];
  });
}
