import { updatedTimestamp } from './sort.model';

export const LAST_ACTIVITY_WINDOWS = ['1d', '3d', '7d', '30d', 'all'] as const;
export type LastActivity = (typeof LAST_ACTIVITY_WINDOWS)[number];
export type ActivityView = 'chats' | 'board';
export type ActivityPreferences = Record<ActivityView, LastActivity>;

export const DEFAULT_LAST_ACTIVITY: ActivityPreferences = { chats: 'all', board: 'all' };

export function isLastActivity(value: unknown): value is LastActivity {
  return LAST_ACTIVITY_WINDOWS.some((window) => window === value);
}

export function parseLastActivity(raw: string): ActivityPreferences {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_LAST_ACTIVITY;
    const saved = value as Record<string, unknown>;
    return { chats: isLastActivity(saved.chats) ? saved.chats : 'all', board: isLastActivity(saved.board) ? saved.board : 'all' };
  } catch {
    return DEFAULT_LAST_ACTIVITY;
  }
}

export function lastActivityLabel(window: LastActivity): string {
  return window === 'all' ? 'All' : window;
}

export function lastActivityCutoff(window: LastActivity, now: number): number | null {
  return window === 'all' ? null : now - Number.parseInt(window, 10) * 86_400_000;
}

export function matchesLastActivity(row: { lastTs?: number | null; createdTs?: number | null }, cutoff: number | null): boolean {
  if (cutoff === null) return true;
  const activity = updatedTimestamp(row);
  return activity !== null && activity >= cutoff;
}
