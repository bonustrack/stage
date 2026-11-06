import { updatedTimestamp } from './sort.model';
import type { LastActivity } from '../../lib/lastActivity.model';

export function lastActivityLabel(window: LastActivity): string {
  return window === 'all' ? 'All' : window;
}

export function matchesLastActivity(row: { lastTs?: number | null; createdTs?: number | null }, cutoff: number | null): boolean {
  if (cutoff === null) return true;
  const activity = updatedTimestamp(row);
  return activity !== null && activity >= cutoff;
}
