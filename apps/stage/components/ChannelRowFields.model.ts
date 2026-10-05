import { CHANNEL_FIELDS, type ChannelFields, type ChannelField } from './home/fields.model';
import type { AppIconName } from './appIcons';

export interface ChannelRowFieldData {
  peerAddress?: string | null;
  inboxToAddr?: Record<string, string>;
  assigned?: string[];
  category?: string | null;
  status?: string | null;
  priority?: string | null;
}

interface VisibleChannelField {
  id: ChannelField;
  label: string;
  icon?: AppIconName;
  value: string;
  addresses: string[];
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

export function visibleChannelFields(data: ChannelRowFieldData, fields: ChannelFields): VisibleChannelField[] {
  if (data.peerAddress) return [];
  return CHANNEL_FIELDS.flatMap(field => {
    if (!fields[field.id] || field.id === 'labels' || field.id === 'avatar') return [];
    if (field.id === 'members' || field.id === 'assignees') {
      const addresses = peopleAddresses(data, field.id);
      return addresses.length === 0 ? [] : [{ id: field.id, label: field.label, value: '', addresses }];
    }
    const value = data[field.id]?.trim() ?? '';
    return value === '' ? [] : [{ ...field, value, addresses: [] }];
  });
}
