import { z } from 'zod';
import { jsonWith } from './storeCore';
import type { HomeView } from './homeView';

export const CHANNEL_FIELD_IDS = ['members', 'assignees', 'category', 'status', 'labels', 'priority', 'avatar', 'lastMessage'] as const;
export type ChannelField = (typeof CHANNEL_FIELD_IDS)[number];
export type ChannelFields = Record<ChannelField, boolean>;
export type ChannelFieldPreferences = Record<HomeView, ChannelFields>;

const defaultFields: ChannelFields = {
  members: false,
  assignees: false,
  category: false,
  status: false,
  labels: false,
  priority: false,
  avatar: false,
  lastMessage: true,
};

export const DEFAULT_CHANNEL_FIELDS: ChannelFieldPreferences = {
  chats: { ...defaultFields, labels: true, avatar: true },
  board: defaultFields,
};

function storedFields(saved: Record<string, unknown>, defaults: ChannelFields): ChannelFields {
  const fields = { ...defaults };
  for (const id of CHANNEL_FIELD_IDS) {
    const visible = saved[id];
    if (typeof visible === 'boolean') fields[id] = visible;
  }
  return fields;
}

function fieldsSchema(defaults: ChannelFields) {
  return z
    .record(z.unknown())
    .transform((saved) => storedFields(saved, defaults))
    .catch(() => ({ ...defaults }));
}

export function channelFieldsSchema(defaults: ChannelFieldPreferences) {
  return z.object({ chats: fieldsSchema(defaults.chats), board: fieldsSchema(defaults.board) }).catch(defaults);
}

export function parseChannelFields(raw: string, chatsAvatarDefault = true): ChannelFieldPreferences {
  const defaults = { ...DEFAULT_CHANNEL_FIELDS, chats: { ...DEFAULT_CHANNEL_FIELDS.chats, avatar: chatsAvatarDefault } };
  return jsonWith(channelFieldsSchema(defaults))(raw) ?? defaults;
}

export function toggleChannelFieldIn(current: ChannelFieldPreferences, view: HomeView, field: ChannelField): ChannelFieldPreferences {
  return { ...current, [view]: { ...current[view], [field]: !current[view][field] } };
}
