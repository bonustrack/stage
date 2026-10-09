import { addLabel, assignedAddresses, categoryOf, parseObject } from '@stage-labs/client/xmtp/labels';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { includesKey } from '../conversation/SidebarSection.model';

export interface NewChatMetadata {
  category: string | null;
  status: string | null;
  labels: string[];
  assigned: string[];
}

export const NO_NEW_CHAT_METADATA: NewChatMetadata = { category: null, status: null, labels: [], assigned: [] };

export type NewChatFields = Pick<NewChatMetadata, 'category'>;

export const NO_NEW_CHAT_FIELDS: NewChatFields = { category: null };

export function parseNewChatFields(raw: string): NewChatFields | undefined {
  const blob = parseObject(raw);
  return blob === null ? undefined : { category: categoryOf(blob.category) };
}

export function renamedNewChatFields(fields: NewChatFields, from: string, to: string | null): NewChatFields {
  if (fields.category === null || fields.category.toLowerCase() !== categoryOf(from)?.toLowerCase()) return fields;
  return { category: to === null ? null : categoryOf(to) };
}

type Params = Record<string, string | string[] | undefined>;
const values = (value: string | string[] | undefined): string[] => typeof value === 'string' ? value.split('\n') : value ?? [];

export function newChatMetadata(params: Params): NewChatMetadata {
  return {
    ...NO_NEW_CHAT_METADATA, status: categoryOf(params.status),
    labels: values(params.labels).reduce(addLabel, []), assigned: assignedAddresses(values(params.assigned)),
  };
}

function metadataFields(metadata: NewChatMetadata): Params {
  return {
    category: metadata.category ?? undefined, status: metadata.status ?? undefined,
    labels: metadata.labels.length > 0 ? metadata.labels : undefined,
    assigned: metadata.assigned.length > 0 ? metadata.assigned : undefined,
  };
}

export function newChatParams(metadata: NewChatMetadata): Record<string, string> {
  return { status: metadata.status ?? '', labels: metadata.labels.join('\n'), assigned: metadata.assigned.join('\n') };
}

export function groupedChatMetadata(by: GroupKey, key: string, title: string): NewChatMetadata {
  const value = key.startsWith(`${by}:`) ? key.slice(by.length + 1) : '';
  if (value === '') return NO_NEW_CHAT_METADATA;
  if (by === 'assignee') return { ...NO_NEW_CHAT_METADATA, assigned: assignedAddresses([value]) };
  if (by === 'label') return { ...NO_NEW_CHAT_METADATA, labels: addLabel([], title) };
  return { ...NO_NEW_CHAT_METADATA, [by]: categoryOf(title) };
}

export function memberChatMetadata(metadata: NewChatMetadata, members: readonly string[], self: string | null): NewChatMetadata {
  const allowed = self === null ? members : [...members, self];
  return { ...metadata, assigned: metadata.assigned.filter(address => includesKey(allowed, address)) };
}

export function newChatAppData(metadata: NewChatMetadata): string | undefined {
  const fields = Object.fromEntries(Object.entries(metadataFields(metadata)).filter(([, value]) => value !== undefined));
  return Object.keys(fields).length === 0 ? undefined : JSON.stringify({ v: 1, ...fields });
}
