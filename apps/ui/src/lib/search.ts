/** Case-insensitive substring match on text / fromName / lineName. Used by the activity feed. */

import type { HistoryEntry } from './types';

export function matchesSearch(e: HistoryEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (e.text?.toLowerCase().includes(q)) return true;
  if (e.fromName?.toLowerCase().includes(q)) return true;
  if (e.lineName?.toLowerCase().includes(q)) return true;
  return false;
}
