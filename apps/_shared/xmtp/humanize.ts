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
  if (typeof decoded === 'string') return decoded;
  if (typeId === 'group_updated' || typeId === 'groupUpdated') {
    return humanizeGroupUpdated(decoded as GroupUpdatedContent);
  }
  if (typeId === 'reaction') {
    const r = decoded as { content?: string; action?: string };
    const removed = r.action === 'removed' || r.action === 'Removed';
    return `[react ${r.content ?? '?'}${removed ? ' (removed)' : ''}]`;
  }
  if (typeId === 'reply') {
    const r = decoded as { content?: { text?: string } | string };
    if (typeof r.content === 'string') return r.content;
    return r.content?.text ?? '[reply]';
  }
  if (typeId === 'attachment') {
    const a = decoded as { filename?: string; mimeType?: string };
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    return a.filename ? `[${kind}: ${a.filename}]` : `[${kind}]`;
  }
  return `[${typeId}]`;
}
