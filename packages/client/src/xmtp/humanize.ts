import { shortAddress } from '../identity/format';
import { describeAppDataChange } from './appDataChange';
interface FieldChange { fieldName: string; oldValue?: string; newValue?: string }
export interface GroupUpdatedContent {
  initiatedByInboxId?: string;
  membersAdded?: { inboxId: string }[];
  membersRemoved?: { inboxId: string }[];
  metadataFieldsChanged?: FieldChange[];
  addedInboxes?: { inboxId: string }[];
  removedInboxes?: { inboxId: string }[];
  metadataFieldChanges?: FieldChange[];
}

function describeFieldChange(f: FieldChange): string {
  if (f.fieldName === 'group_name') return `renamed the group to "${f.newValue}"`;
  if (f.fieldName === 'group_image_url_square') return 'updated the group image';
  if (f.fieldName === 'description') return 'updated the group description';
  if (f.fieldName === 'app_data') return describeAppDataChange(f.oldValue, f.newValue);
  return `changed ${f.fieldName.replace(/_/g, ' ')}`;
}

const GROUP_UPDATE_TYPE_IDS: readonly string[] = ['group_updated', 'groupUpdated'];

export function isGroupUpdateTypeId(typeId: string | undefined): boolean {
  return typeId !== undefined && GROUP_UPDATE_TYPE_IDS.includes(typeId);
}

export type InboxNamer = (inboxId: string) => string | null;

const MAX_NAMED_MEMBERS = 3;

function namedList(names: string[]): string {
  if (names.length <= MAX_NAMED_MEMBERS) {
    return names.length === 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
  }
  const others = names.length - (MAX_NAMED_MEMBERS - 1);
  return `${names.slice(0, MAX_NAMED_MEMBERS - 1).join(', ')} and ${others} others`;
}

function memberClause(verb: string, members: { inboxId: string }[], nameOf?: InboxNamer): string {
  if (members.length === 0) return '';
  const names = nameOf ? members.map(m => nameOf(m.inboxId)) : [];
  if (names.length > 0 && names.every((n): n is string => !!n)) return `${verb} ${namedList(names)}`;
  return `${verb} ${members.length} member${members.length === 1 ? '' : 's'}`;
}

export function humanizeGroupUpdated(g: GroupUpdatedContent, nameOf?: InboxNamer): string {
  const fields = g.metadataFieldsChanged ?? g.metadataFieldChanges ?? [];
  const parts = [
    ...fields.map(describeFieldChange),
    memberClause('added', g.membersAdded ?? g.addedInboxes ?? [], nameOf),
    memberClause('removed', g.membersRemoved ?? g.removedInboxes ?? [], nameOf),
  ].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'updated the group';
}

const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

export function humanizeMentions(text: string): string {
  if (!text.includes('@0x')) return text;
  return text.replace(MENTION_RE, (_m, addr: string) => `@${shortAddress(addr)}`);
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
  reaction: decoded => (decoded as { content?: string }).content ?? '👍',
  poll: previewPoll,
  reply: previewReply,
  attachment: decoded => {
    const a = decoded as { filename?: string; mimeType?: string };
    return attachmentEmojiPreview(a.mimeType, a.filename);
  },
};

export function previewOfXmtpContent(decoded: unknown, contentTypeId: string | undefined | null): string {
  const typeId = shortContentType(contentTypeId);
  if (typeof decoded === 'string') return humanizeMentions(decoded);
  const handler = PREVIEW_HANDLERS[typeId];
  return handler ? handler(decoded) : `[${typeId}]`;
}

export function attachmentEmojiPreview(mimeType?: string | null, filename?: string | null): string {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
  const mime = mimeType ?? '';
  if (matchesKind(mime, ext, 'image/', IMAGE_EXTS)) return '📷';
  if (matchesKind(mime, ext, 'audio/', AUDIO_EXTS)) return '🎤';
  if (matchesKind(mime, ext, 'video/', VIDEO_EXTS)) return '🎥';
  return '📎';
}

function matchesKind(mime: string, ext: string, mimePrefix: string, exts: string[]): boolean {
  return mime.startsWith(mimePrefix) || exts.includes(ext);
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif'];
const AUDIO_EXTS = ['m4a', 'mp3', 'wav', 'aac', 'ogg'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];
