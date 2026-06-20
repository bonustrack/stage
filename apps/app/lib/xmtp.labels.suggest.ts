
import { getCachedRows } from './channelsCache';

function rowLabels(row: unknown): string[] {
  if (!row || typeof row !== 'object') return [];
  const raw = (row as { labels?: unknown }).labels;
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is string => typeof l === 'string');
}

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
