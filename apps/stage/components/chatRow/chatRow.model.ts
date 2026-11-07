export interface UnreadRow {
  unreadCount: number;
  markedUnread?: boolean;
}

export function isUnreadRow(row: UnreadRow): boolean {
  return row.unreadCount > 0 || row.markedUnread === true;
}

export const NO_MESSAGES_PREVIEW = '(no messages yet)';
const SELF_PREVIEW_PREFIX = 'You: ';

interface RowPreviewModel {
  preview: string | null | undefined;
  dm: boolean;
  fromSelf: boolean;
  senderLabel: string | null;
}

export function rowPreviewText(m: RowPreviewModel): string {
  if (!m.preview) return NO_MESSAGES_PREVIEW;
  if (m.fromSelf) return `${SELF_PREVIEW_PREFIX}${m.preview}`;
  if (m.dm || m.senderLabel === null) return m.preview;
  return `${m.senderLabel}: ${m.preview}`;
}
