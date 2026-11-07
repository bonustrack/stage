export function channelTimestamp(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parsed(iso: string): number | null {
  if (iso.length === 0) return null;
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? null : then;
}

export function bubbleTimestamp(ts: string): string {
  const then = parsed(ts);
  if (then === null) return '';
  try {
    return new Date(then).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return ts.slice(11, 16);
  }
}

export function timeAgo(iso: string, now: number): string {
  const then = parsed(iso);
  if (then === null) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function unreadBadgeLabel(count: number): string | undefined {
  if (count > 0) return count > 99 ? '99+' : String(count);
  return undefined;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const compareNames = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function clockLabel(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
