import { z } from 'zod';

export const LAST_ACTIVITY_WINDOWS = ['1d', '3d', '7d', '30d', 'all'] as const;
export type LastActivity = (typeof LAST_ACTIVITY_WINDOWS)[number];
export type ActivityView = 'chats' | 'board';
export type ActivityPreferences = Record<ActivityView, LastActivity>;

export const DEFAULT_LAST_ACTIVITY: ActivityPreferences = { chats: 'all', board: 'all' };

export function isLastActivity(value: unknown): value is LastActivity {
  return LAST_ACTIVITY_WINDOWS.some((window) => window === value);
}

export function lastActivityCutoff(window: LastActivity, now: number): number | null {
  return window === 'all' ? null : now - Number.parseInt(window, 10) * 86_400_000;
}

const storedWindow = z.enum(LAST_ACTIVITY_WINDOWS).catch('all');

export const lastActivitySchema = z.object({ chats: storedWindow, board: storedWindow });
