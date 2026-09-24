const FRESH_BUILD_MS = 30 * 60 * 1000;

function parsed(iso: string): number | null {
  if (iso.length === 0) return null;
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? null : then;
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

export function isFreshBuild(iso: string, now: number): boolean {
  const then = parsed(iso);
  return then !== null && now - then < FRESH_BUILD_MS;
}
