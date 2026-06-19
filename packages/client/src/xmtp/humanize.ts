/** Cross-platform humanisation for decoded XMTP message content. Shared by
 *  the mobile envelope builder and the channels-list preview path on both
 *  mobile and web — without this the channels row falls back to the raw
 *  `[xmtp.org/group_updated:1.0]` label instead of "removed 1 member". */

interface FieldChange { fieldName: string; oldValue?: string; newValue?: string }
/** The RN SDK and the browser/wasm SDK name these fields differently
 *  (`membersAdded`/`addedInboxes`, `metadataFieldsChanged`/`metadataFieldChanges`),
 *  so accept either shape. */
export interface GroupUpdatedContent {
  initiatedByInboxId?: string;
  membersAdded?: { inboxId: string }[];
  membersRemoved?: { inboxId: string }[];
  metadataFieldsChanged?: FieldChange[];
  addedInboxes?: { inboxId: string }[];
  removedInboxes?: { inboxId: string }[];
  metadataFieldChanges?: FieldChange[];
}

/** Summarise a group_updated system message as one readable line (renames, image/description edits, members added or removed). */
export function humanizeGroupUpdated(g: GroupUpdatedContent): string {
  const parts: string[] = [];
  const fields = g.metadataFieldsChanged ?? g.metadataFieldChanges ?? [];
  for (const f of fields) {
    if (f.fieldName === 'group_name') parts.push(`renamed the group to "${f.newValue}"`);
    else if (f.fieldName === 'group_image_url_square') parts.push('updated the group image');
    else if (f.fieldName === 'description') parts.push('updated the group description');
    else parts.push(`changed ${f.fieldName.replace(/_/g, ' ')}`);
  }
  const addedCount = (g.membersAdded ?? g.addedInboxes)?.length ?? 0;
  if (addedCount) parts.push(`added ${addedCount} member${addedCount === 1 ? '' : 's'}`);
  const removedCount = (g.membersRemoved ?? g.removedInboxes)?.length ?? 0;
  if (removedCount) parts.push(`removed ${removedCount} member${removedCount === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' • ') : 'updated the group';
}

/** Mention wire form stored in the raw XMTP message text: a bare address,
 *  `@0x<40 hex>`. The address is the source of truth; the bubble renderer
 *  resolves it to a tappable `@<username>` at render time. */
const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

/** Collapse an address mention `@0xABCD…1234` → the friendly short form
 *  `@0xabcd…1234` (first 6 + last 4 of the address, matching `shortAddress`'s
 *  `…` style) for any plain-text / preview / snippet context (channel-list
 *  rows, reply previews, push text) so the raw 42-char address never leaks.
 *  This is a pure helper with no profile lookup available, so it can't resolve
 *  the username — the live bubble renderer does that. No-op (cheap) when the
 *  text has no address mentions. */
export function humanizeMentions(text: string): string {
  if (!text.includes('@0x')) return text;
  return text.replace(MENTION_RE, (_m, addr: string) =>
    `@${addr.slice(0, 6)}…${addr.slice(-4)}`);
}

/** Normalise a content-type id — RN SDK returns the full
 *  `xmtp.org/group_updated:1.0` form, browser SDK returns the short
 *  `group_updated`. Reduce both to the short authority-less name. */
export function shortContentType(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  return raw.split('/').pop()?.split(':')[0] ?? raw;
}

/** Build a one-line human-readable preview for any decoded XMTP message
 *  content. Used by the channels-list row and the daemon-side `query` /
 *  `listConvs` actions to surface system messages as readable text. */
export function previewOfXmtpContent(decoded: unknown, contentTypeId: string | undefined | null): string {
  const typeId = shortContentType(contentTypeId);
  if (typeof decoded === 'string') return humanizeMentions(decoded);
  if (typeId === 'group_updated' || typeId === 'groupUpdated') {
    return humanizeGroupUpdated(decoded as GroupUpdatedContent);
  }
  if (typeId === 'reaction') {
    // Preview as just the emoji (e.g. "🔥") rather than "[react 🔥]".
    const r = decoded as { content?: string };
    return r.content ?? '👍';
  }
  if (typeId === 'poll') {
    const p = decoded as { question?: string; questions?: { question?: string }[] };
    const title = p.questions?.[0]?.question ?? p.question;
    return title ? `Poll: ${title}` : '[poll]';
  }
  if (typeId === 'reply') {
    const r = decoded as { content?: { text?: string } | string };
    if (typeof r.content === 'string') return humanizeMentions(r.content);
    return r.content?.text ? humanizeMentions(r.content.text) : '[reply]';
  }
  if (typeId === 'attachment') {
    const a = decoded as { filename?: string; mimeType?: string };
    return attachmentEmojiPreview(a.mimeType, a.filename);
  }
  return `[${typeId}]`;
}

/** Map an attachment to a clean emoji preview (no filename noise) for the
 *  channels-list row, reply previews and push text:
 *    image → 📷, audio/voice → 🎤, video → 🎥, anything else → 📎.
 *  MIME type is authoritative; falls back to the filename extension when the
 *  remote-attachment metadata omits the MIME (multi-remote attachments). */
export function attachmentEmojiPreview(mimeType?: string | null, filename?: string | null): string {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
  const isImage = (mimeType?.startsWith('image/') ?? false) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext);
  const isAudio = (mimeType?.startsWith('audio/') ?? false) || ['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext);
  const isVideo = (mimeType?.startsWith('video/') ?? false) || ['mp4', 'mov', 'webm'].includes(ext);
  if (isImage) return '📷';
  if (isAudio) return '🎤';
  if (isVideo) return '🎥';
  return '📎';
}
