export interface UnreadRow {
  unreadCount: number;
  markedUnread?: boolean;
}

export function isUnreadRow(row: UnreadRow): boolean {
  return row.unreadCount > 0 || row.markedUnread === true;
}
