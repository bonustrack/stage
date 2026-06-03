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

/** Parse the {labels, github} we own out of a raw appData string. Tolerant:
 *  empty / old / malformed → { labels: [], github: undefined }. */
export function readAppData(appData: string | undefined): { labels: string[]; github?: string } {
  if (!appData || !appData.trim()) return { labels: [] };
  try {
    const p: unknown = JSON.parse(appData);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { labels: [] };
    const rec = p as Record<string, unknown>;
    const github = typeof rec['github'] === 'string' && (rec['github'] as string).trim()
      ? (rec['github'] as string).trim() : undefined;
    return { labels: cleanLabels(rec['labels']), github };
  } catch {
    return { labels: [] };
  }
}

/** Validate a GitHub URL. Returns the normalised URL, or throws. Empty string is
 *  the caller's "clear" sentinel and is allowed through unchanged. */
export function normalizeGithubUrl(url: unknown): string {
  if (typeof url !== 'string') throw new Error('setGithub requires a `url` string');
  const trimmed = url.trim();
  if (!trimmed) return ''; // clear sentinel
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { throw new Error(`invalid url: ${trimmed}`); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`github url must be http(s): ${trimmed}`);
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    throw new Error(`url must be a github.com URL: ${trimmed}`);
  }
  return trimmed;
}
