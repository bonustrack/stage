/** Group label/appData helpers shared by the conversation actions. */

/** Minimal structural view of the node-sdk Group surface we touch. `appData` is
 *  a SYNC getter (string); updateAppData/updateName/updateDescription are async. */
export interface GroupLike {
  id: string;
  appData?: string;
  updateAppData?: (s: string) => Promise<void>;
  updateName?: (s: string) => Promise<void>;
  updateDescription?: (s: string) => Promise<void>;
  removeMembers?: (inboxIds: string[]) => Promise<void>;
  sync?: () => Promise<unknown>;
}

const MAX_LABELS = 16;
const MAX_LABEL_LEN = 24;

/** Clean/dedupe labels — matches apps/app/lib/xmtp.labels.ts: trim, collapse
 *  whitespace, cap len 24, dedupe case-insensitively, cap 16. */
export function cleanLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const label = item.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_LABELS) break;
  }
  return out;
}

/** Build the {v:1, labels, github?} appData blob, MERGING into existing appData
 *  so we never clobber other keys. `github`: a string sets/replaces the linked
 *  GitHub URL, '' clears it, undefined leaves any existing value untouched. */
export function labelsBlob(
  existingAppData: string | undefined,
  labels: string[],
  github?: string,
): string {
  let existing: Record<string, unknown> = {};
  if (existingAppData && existingAppData.trim()) {
    try {
      const p: unknown = JSON.parse(existingAppData);
      if (p && typeof p === 'object' && !Array.isArray(p)) existing = p as Record<string, unknown>;
    } catch { /* tolerate malformed */ }
  }
  const blob: Record<string, unknown> = { ...existing, v: 1, labels: cleanLabels(labels) };
  if (typeof github === 'string') {
    if (github.trim()) blob['github'] = github.trim();
    else delete blob['github'];
  }
  return JSON.stringify(blob);
}
