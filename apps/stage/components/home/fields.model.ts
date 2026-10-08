import type { AppIconName } from '../appIcons';

export type ChannelField = 'members' | 'assignees' | 'category' | 'status' | 'labels' | 'priority' | 'avatar';
export type ChannelFields = Record<ChannelField, boolean>;
export type ChannelFieldView = 'chats' | 'board';
export type ChannelFieldPreferences = Record<ChannelFieldView, ChannelFields>;

export const CHANNEL_FIELDS: readonly { id: ChannelField; label: string; icon?: AppIconName }[] = [
  { id: 'members', label: 'Members', icon: 'IconPeople' },
  { id: 'assignees', label: 'Assignees', icon: 'IconPeopleCircle' },
  { id: 'category', label: 'Project', icon: 'IconFolder1' },
  { id: 'status', label: 'Status', icon: 'IconCircleDashed' },
  { id: 'labels', label: 'Labels', icon: 'IconTag' },
  { id: 'priority', label: 'Priority', icon: 'IconFlag1' },
  { id: 'avatar', label: 'Avatar', icon: 'IconPeopleCircle' },
];

const hiddenFields: ChannelFields = {
  members: false, assignees: false, category: false, status: false, labels: false, priority: false, avatar: false,
};

export const DEFAULT_CHANNEL_FIELDS: ChannelFieldPreferences = {
  chats: { ...hiddenFields, labels: true, avatar: true },
  board: hiddenFields,
};

export function visibleChannelFieldCount(fields: ChannelFields): number {
  return CHANNEL_FIELDS.filter(({ id }) => fields[id]).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFields(value: unknown, defaults: ChannelFields): ChannelFields {
  const fields = { ...defaults };
  if (!isRecord(value)) return fields;
  for (const { id } of CHANNEL_FIELDS) {
    const visible = value[id];
    if (typeof visible === 'boolean') fields[id] = visible;
  }
  return fields;
}

export function parseChannelFields(raw: string, chatsAvatarDefault = true): ChannelFieldPreferences {
  const defaults = {
    ...DEFAULT_CHANNEL_FIELDS,
    chats: { ...DEFAULT_CHANNEL_FIELDS.chats, avatar: chatsAvatarDefault },
  };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return defaults;
    return {
      chats: parseFields(value.chats, defaults.chats),
      board: parseFields(value.board, defaults.board),
    };
  } catch { return defaults; }
}

export function toggleChannelFieldIn(
  current: ChannelFieldPreferences, view: ChannelFieldView, field: ChannelField,
): ChannelFieldPreferences {
  return { ...current, [view]: { ...current[view], [field]: !current[view][field] } };
}
