/** @file Cross-platform humanisation of decoded XMTP content (notably group_updated system messages) into one readable line, shared by the mobile envelope builder and the channels-list preview path so rows don't show raw type labels. */

interface FieldChange { fieldName: string; oldValue?: string; newValue?: string }
/** The RN SDK and the browser/wasm SDK name these fields differently (`membersAdded`/`addedInboxes`, `metadataFieldsChanged`/`metadataFieldChanges`), so accept either shape. */
export interface GroupUpdatedContent {
  initiatedByInboxId?: string;
  membersAdded?: { inboxId: string }[];
  membersRemoved?: { inboxId: string }[];
  metadataFieldsChanged?: FieldChange[];
  addedInboxes?: { inboxId: string }[];
  removedInboxes?: { inboxId: string }[];
  metadataFieldChanges?: FieldChange[];
}

/** Describe one metadata field change as a readable clause (rename, image/description edit, or a generic "changed X"). */
function describeFieldChange(f: FieldChange): string {
  if (f.fieldName === 'group_name') return `renamed the group to "${f.newValue}"`;
  if (f.fieldName === 'group_image_url_square') return 'updated the group image';
  if (f.fieldName === 'description') return 'updated the group description';
  return `changed ${f.fieldName.replace(/_/g, ' ')}`;
}

/** Format `<verb> N member(s)` for a non-zero count, else '' (so an empty clause can be filtered out). */
function memberClause(verb: string, count: number): string {
  return count ? `${verb} ${count} member${count === 1 ? '' : 's'}` : '';
}

/** Summarise a group_updated system message as one readable line (renames, image/description edits, members added or removed). */
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

/** Mention wire form stored in the raw XMTP message text: a bare address, `@0x<40 hex>`. The address is the source of truth; the bubble renderer resolves it to a tappable `@<username>` at render time. */
const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

/** Collapse an address mention `@0xABCD…1234` to the short `@0x…` form (first 6 + last 4) for plain-text/preview contexts so the raw address never leaks; pure, so it can't resolve usernames, and a no-op when the text has no mentions. */
export function humanizeMentions(text: string): string {
  if (!text.includes('@0x')) return text;
  return text.replace(MENTION_RE, (_m, addr: string) =>
    `@${addr.slice(0, 6)}…${addr.slice(-4)}`);
}

/** Normalise a content-type id — RN SDK returns the full `xmtp.org/group_updated:1.0` form, browser SDK returns the short `group_updated`. Reduce both to the short authority-less name. */
export function shortContentType(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  return raw.split('/').pop()?.split(':')[0] ?? raw;
}

/** Preview a `reply` content as its (mention-humanised) inner text, else `[reply]`. */
function previewReply(decoded: unknown): string {
  const r = decoded as { content?: { text?: string } | string };
  if (typeof r.content === 'string') return humanizeMentions(r.content);
  return r.content?.text ? humanizeMentions(r.content.text) : '[reply]';
}

/** Preview a `poll` content as `Poll: <first question>`, else `[poll]`. */
function previewPoll(decoded: unknown): string {
  const p = decoded as { question?: string; questions?: { question?: string }[] };
  const title = p.questions?.[0]?.question ?? p.question;
  return title ? `Poll: ${title}` : '[poll]';
}

/** Per-typeId preview builders for non-string decoded XMTP content (channels-list row + daemon query/listConvs). */
const PREVIEW_HANDLERS: Record<string, (decoded: unknown) => string> = {
  group_updated: decoded => humanizeGroupUpdated(decoded as GroupUpdatedContent),
  groupUpdated: decoded => humanizeGroupUpdated(decoded as GroupUpdatedContent),
  /** Preview a reaction as just the emoji (e.g. "🔥") rather than "[react 🔥]". */
  reaction: decoded => (decoded as { content?: string }).content ?? '👍',
  poll: previewPoll,
  reply: previewReply,
  attachment: decoded => {
    const a = decoded as { filename?: string; mimeType?: string };
    return attachmentEmojiPreview(a.mimeType, a.filename);
  },
};

/** Build a one-line human-readable preview for any decoded XMTP message content. Used by the channels-list row and the daemon-side `query` / `listConvs` actions to surface system messages as readable text. */
export function previewOfXmtpContent(decoded: unknown, contentTypeId: string | undefined | null): string {
  const typeId = shortContentType(contentTypeId);
  if (typeof decoded === 'string') return humanizeMentions(decoded);
  const handler = PREVIEW_HANDLERS[typeId];
  return handler ? handler(decoded) : `[${typeId}]`;
}

/** Map an attachment to a clean emoji preview (image → 📷, audio → 🎤, video → 🎥, else → 📎) for previews, using MIME as authoritative and falling back to the filename extension when MIME is absent. */
export function attachmentEmojiPreview(mimeType?: string | null, filename?: string | null): string {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
  const mime = mimeType ?? '';
  if (matchesKind(mime, ext, 'image/', IMAGE_EXTS)) return '📷';
  if (matchesKind(mime, ext, 'audio/', AUDIO_EXTS)) return '🎤';
  if (matchesKind(mime, ext, 'video/', VIDEO_EXTS)) return '🎥';
  return '📎';
}

/** True when a MIME prefix matches, or (when MIME is absent/other) the filename extension is in the kind's list. */
function matchesKind(mime: string, ext: string, mimePrefix: string, exts: string[]): boolean {
  return mime.startsWith(mimePrefix) || exts.includes(ext);
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
const AUDIO_EXTS = ['m4a', 'mp3', 'wav', 'aac', 'ogg'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];
