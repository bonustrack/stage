export function channelTimestamp(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function bubbleTimestamp(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

export function unreadBadgeLabel(count: number, markedUnread = false): string | undefined {
  if (count > 0) return count > 99 ? '99+' : String(count);
  if (markedUnread) return '·';
  return undefined;
}
