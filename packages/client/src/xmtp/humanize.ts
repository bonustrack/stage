
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
  return `changed ${f.fieldName.replace(/_/g, ' ')}`;
}

function memberClause(verb: string, count: number): string {
  return count ? `${verb} ${count} member${count === 1 ? '' : 's'}` : '';
}

export function humanizeGroupUpdated(g: GroupUpdatedContent): string {
  const fields = g.metadataFieldsChanged ?? g.metadataFieldChanges ?? [];
  const added = (g.membersAdded ?? g.addedInboxes)?.length ?? 0;
  const removed = (g.membersRemoved ?? g.removedInboxes)?.length ?? 0;
  const parts = [
    ...fields.map(describeFieldChange),
    memberClause('added', added),
    memberClause('removed', removed),
  ].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'updated the group';
}

const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

export function humanizeMentions(text: string): string {
  if (!text.includes('@0x')) return text;
  return text.replace(MENTION_RE, (_m, addr: string) =>
    `@${addr.slice(0, 6)}…${addr.slice(-4)}`);
}

export function shortContentType(raw: string | undefined | null): string {
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

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
const AUDIO_EXTS = ['m4a', 'mp3', 'wav', 'aac', 'ogg'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];
