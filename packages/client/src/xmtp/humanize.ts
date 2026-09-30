import { shortAddress } from '../identity/format';
import { describeAppDataChange } from './appDataChange';
import { withChannelLabels } from './channelRefs';
import { DELETED_MESSAGE_TEXT, DELETED_MESSAGE_TYPE_ID, DELETE_MESSAGE_TYPE_ID } from './deleteMessage';
interface FieldChange { fieldName: string; oldValue?: string; newValue?: string }
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
  if (f.fieldName === 'description') return 'updated the channel description';
  if (f.fieldName === 'app_data') return describeAppDataChange(f.oldValue, f.newValue);
  return `changed ${f.fieldName.replace(/_/g, ' ')}`;
}

const GROUP_UPDATE_TYPE_IDS: readonly string[] = ['group_updated', 'groupUpdated'];

export function isGroupUpdateTypeId(typeId: string | undefined): boolean {
  return typeId !== undefined && GROUP_UPDATE_TYPE_IDS.includes(typeId);
}

export const LEAVE_REQUEST_TYPE_ID = 'leave_request';

export const LEFT_CHANNEL_TEXT = 'left the channel';

export type InboxNamer = (inboxId: string) => string | null;

const MAX_NAMED_MEMBERS = 3;

function namedList(names: string[], total: number): string {
  if (names.length === total && total <= MAX_NAMED_MEMBERS) {
    return total === 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
  }
  const shown = names.slice(0, MAX_NAMED_MEMBERS - 1);
  const others = total - shown.length;
  return `${shown.join(', ')} and ${others} other${others === 1 ? '' : 's'}`;
}

function membersPhrase(members: { inboxId: string }[], nameOf?: InboxNamer): string {
  const names = nameOf ? members.map(m => nameOf(m.inboxId)).filter((n): n is string => !!n) : [];
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
  return [...addedOf(g), ...removedOf(g), ...(g.leftInboxes ?? [])].map(m => m.inboxId);
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

const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

export function humanizeMentions(text: string): string {
  const named = withChannelLabels(text);
  if (!named.includes('@0x')) return named;
  return named.replace(MENTION_RE, (_m, addr: string) => `@${shortAddress(addr)}`);
}

function shortContentType(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  return raw.split('/').pop()?.split(':')[0] ?? raw;
}

function previewReply(decoded: unknown): string {
  const r = decoded as { content?: { text?: string } | string };
  if (typeof r.content === 'string') return humanizeMentions(r.content);
  return r.content?.text ? humanizeMentions(r.content.text) : '[reply]';
}

function previewPoll(decoded: unknown): string {
  const p = decoded as { question?: string; questions?: { question?: string }[] };
  const title = p.questions?.[0]?.question ?? p.question;
  return title ? `Poll: ${title}` : '[poll]';
}

const PREVIEW_HANDLERS: Record<string, (decoded: unknown) => string> = {
  group_updated: decoded => humanizeGroupUpdated(decoded as GroupUpdatedContent),
  groupUpdated: decoded => humanizeGroupUpdated(decoded as GroupUpdatedContent),
  [LEAVE_REQUEST_TYPE_ID]: () => LEFT_CHANNEL_TEXT,
  reaction: decoded => (decoded as { content?: string }).content ?? '👍',
  poll: previewPoll,
  reply: previewReply,
  attachment: previewSingleAttachment,
  remoteStaticAttachment: previewSingleAttachment,
  multiRemoteStaticAttachment: previewMultiRemote,
  multiRemoteAttachment: previewMultiRemote,
  [DELETED_MESSAGE_TYPE_ID]: () => DELETED_MESSAGE_TEXT,
  [DELETE_MESSAGE_TYPE_ID]: () => DELETED_MESSAGE_TEXT,
};

export function previewOfXmtpContent(decoded: unknown, contentTypeId: string | undefined | null): string {
  const typeId = shortContentType(contentTypeId);
  if (typeof decoded === 'string') return humanizeMentions(decoded);
  const handler = PREVIEW_HANDLERS[typeId];
  return handler ? handler(decoded) : `[${typeId}]`;
}

type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface AttachmentMeta { mimeType?: string | null; filename?: string | null }

function attachmentKindOf(a: AttachmentMeta): AttachmentKind {
  const ext = a.filename?.split('.').pop()?.toLowerCase() ?? '';
  const mime = a.mimeType ?? '';
  if (matchesKind(mime, ext, 'image/', IMAGE_EXTS)) return 'image';
  if (matchesKind(mime, ext, 'audio/', AUDIO_EXTS)) return 'audio';
  if (matchesKind(mime, ext, 'video/', VIDEO_EXTS)) return 'video';
  return 'file';
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
  const noun = rest.every(k => k === first) ? KIND_NOUNS[first].many : 'attachments';
  return `Sent ${rest.length + 1} ${noun}`;
}

function previewSingleAttachment(decoded: unknown): string {
  return attachmentsPreview(decoded ? [decoded] : []);
}

function previewMultiRemote(decoded: unknown): string {
  const content = decoded as { attachments?: AttachmentMeta[] } | null | undefined;
  return attachmentsPreview(content?.attachments ?? []);
}

function matchesKind(mime: string, ext: string, mimePrefix: string, exts: string[]): boolean {
  return mime.startsWith(mimePrefix) || exts.includes(ext);
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif'];
const AUDIO_EXTS = ['m4a', 'mp3', 'wav', 'aac', 'ogg'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];
