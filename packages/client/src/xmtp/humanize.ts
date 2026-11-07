import { fileExtension, kindExtensions, type MediaKind } from '../files';
import { shortAddress } from '../identity/format';
import { describeAppDataChange } from './appDataChange';
import { withChannelLabels } from './channelRefs';
import { MENTION_RE } from './mentions';

interface FieldChange {
  fieldName: string;
  oldValue?: string;
  newValue?: string;
}
export interface GroupUpdatedContent {
  initiatedByInboxId?: string;
  membersAdded?: { inboxId: string }[];
  membersRemoved?: { inboxId: string }[];
  metadataFieldsChanged?: FieldChange[];
  addedInboxes?: { inboxId: string }[];
  removedInboxes?: { inboxId: string }[];
  leftInboxes?: { inboxId: string }[];
  metadataFieldChanges?: FieldChange[];
}

function describeFieldChange(f: FieldChange): string {
  if (f.fieldName === 'group_name') return `renamed the channel to "${f.newValue}"`;
  if (f.fieldName === 'group_image_url_square') return 'updated the channel image';
  if (f.fieldName === 'description' || f.fieldName === 'group_description') return 'updated the channel description';
  if (f.fieldName === 'app_data') return describeAppDataChange(f.oldValue, f.newValue);
  return `changed ${f.fieldName.replace(/_/g, ' ')}`;
}

export const LEFT_CHANNEL_TEXT = 'left the channel';

export type InboxNamer = (inboxId: string) => string | null;

const MAX_NAMED_MEMBERS = 3;

function namedList(names: string[], total: number): string {
  if (names.length === total && total <= MAX_NAMED_MEMBERS) {
    return total === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
  }
  const shown = names.slice(0, MAX_NAMED_MEMBERS - 1);
  const others = total - shown.length;
  return `${shown.join(', ')} and ${others} other${others === 1 ? '' : 's'}`;
}

function membersPhrase(members: { inboxId: string }[], nameOf?: InboxNamer): string {
  const names = nameOf ? members.map((m) => nameOf(m.inboxId)).filter((n): n is string => !!n) : [];
  if (names.length > 0) return namedList(names, members.length);
  return `${members.length} member${members.length === 1 ? '' : 's'}`;
}

function memberClause(verb: string, members: { inboxId: string }[], nameOf?: InboxNamer): string {
  return members.length === 0 ? '' : `${verb} ${membersPhrase(members, nameOf)}`;
}

function leftClause(members: { inboxId: string }[], nameOf?: InboxNamer): string {
  return members.length === 0 ? '' : `${membersPhrase(members, nameOf)} ${LEFT_CHANNEL_TEXT}`;
}

function addedOf(g: GroupUpdatedContent): { inboxId: string }[] {
  return g.membersAdded ?? g.addedInboxes ?? [];
}

function removedOf(g: GroupUpdatedContent): { inboxId: string }[] {
  return g.membersRemoved ?? g.removedInboxes ?? [];
}

export function groupUpdateInboxIds(g: GroupUpdatedContent): string[] {
  return [...addedOf(g), ...removedOf(g), ...(g.leftInboxes ?? [])].map((m) => m.inboxId);
}

function changeClauses(g: GroupUpdatedContent, nameOf?: InboxNamer): string[] {
  const fields = g.metadataFieldsChanged ?? g.metadataFieldChanges ?? [];
  return [
    ...fields.map(describeFieldChange),
    memberClause('added', addedOf(g), nameOf),
    memberClause('removed', removedOf(g), nameOf),
  ].filter(Boolean);
}

export function onlyMembersLeft(g: GroupUpdatedContent): boolean {
  return (g.leftInboxes ?? []).length > 0 && changeClauses(g).length === 0;
}

export function humanizeGroupUpdated(g: GroupUpdatedContent, nameOf?: InboxNamer): string {
  const parts = [...changeClauses(g, nameOf), leftClause(g.leftInboxes ?? [], nameOf)].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'updated the channel';
}

export function humanizeMentions(text: string): string {
  const named = withChannelLabels(text);
  if (!named.includes('@0x')) return named;
  return named.replace(MENTION_RE, (_m, addr: string) => `@${shortAddress(addr)}`);
}

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface AttachmentMeta {
  mimeType?: string | null;
  filename?: string | null;
}

const MEDIA_KINDS: readonly MediaKind[] = ['image', 'audio', 'video'];

const KIND_EXTENSIONS: Record<MediaKind, string[]> = {
  image: kindExtensions('image'),
  audio: kindExtensions('audio'),
  video: kindExtensions('video'),
};

export function isSvgAttachment(a: AttachmentMeta): boolean {
  return /^image\/svg/i.test(a.mimeType?.trim() ?? '') || /\.svgz?$/i.test(a.filename?.trim() ?? '');
}

export function attachmentKindOf(a: AttachmentMeta): AttachmentKind {
  if (isSvgAttachment(a)) return 'file';
  const ext = fileExtension(a.filename ?? '');
  const mime = a.mimeType ?? '';
  return MEDIA_KINDS.find((kind) => mime.startsWith(`${kind}/`) || KIND_EXTENSIONS[kind].includes(ext)) ?? 'file';
}

export function entryAttachmentKind(att: { kind: string; mime?: string; name?: string }): string {
  if (isSvgAttachment({ mimeType: att.mime, filename: att.name })) return 'file';
  return MEDIA_KINDS.find((kind) => att.mime?.startsWith(`${kind}/`) === true) ?? att.kind;
}

const KIND_EMOJI: Record<AttachmentKind, string> = { image: '📷', audio: '🎤', video: '🎥', file: '📎' };

export function attachmentEmojiPreview(mimeType?: string | null, filename?: string | null): string {
  return KIND_EMOJI[attachmentKindOf({ mimeType, filename })];
}

const KIND_NOUNS: Record<AttachmentKind, { one: string; many: string }> = {
  image: { one: 'an image', many: 'images' },
  audio: { one: 'a voice message', many: 'voice messages' },
  video: { one: 'a video', many: 'videos' },
  file: { one: 'a file', many: 'files' },
};

export function attachmentsPreview(items: readonly AttachmentMeta[]): string {
  const [first, ...rest] = items.map(attachmentKindOf);
  if (!first) return 'Sent an attachment';
  if (rest.length === 0) return `Sent ${KIND_NOUNS[first].one}`;
  const noun = rest.every((k) => k === first) ? KIND_NOUNS[first].many : 'attachments';
  return `Sent ${rest.length + 1} ${noun}`;
}
