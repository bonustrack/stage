/** @file Label suggestions: surface labels the user has already used across their other groups, read purely from the in-memory channels-list cache (`getCachedRows`) with no per-group re-sync. */

import { getCachedRows } from './channelsCache';

/** Each cached channel row carries a `labels` array (groups only; DMs []). The cache type is opaque ([key: string]: unknown), so narrow it structurally. */
function rowLabels(row: unknown): string[] {
  if (!row || typeof row !== 'object') return [];
  const raw = (row as { labels?: unknown }).labels;
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is string => typeof l === 'string');
}

/** Union of every label across all the user's groups, deduped case-insensitively (first-seen casing) and sorted A→Z from the in-memory channels cache; returns [] before the list has populated it. */
export function getAllKnownLabels(): string[] {
  const rows = getCachedRows();
  if (!rows) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const label of rowLabels(row)) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/** Suggestions for this group's add-label input: known labels minus those already applied (case-insensitive), optionally substring-filtered by the input, excluding an exact match of the query itself. */
export function suggestLabels(query: string, applied: string[]): string[] {
  const appliedKeys = new Set(applied.map((l) => l.toLowerCase()));
  const q = query.trim().toLowerCase();
  return getAllKnownLabels().filter((label) => {
    const key = label.toLowerCase();
    if (appliedKeys.has(key)) return false;
    if (!q) return true;
    if (key === q) return false;
    return key.includes(q);
  });
}
