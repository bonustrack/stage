/** Group LABELS — small free-form tags stored in the XMTP group's synced
 *  `appData` slot (a single string, MLS-encrypted E2E to all members). All
 *  members of an all-members group may edit. Labels are group metadata, kept
 *  separate from any per-token UI badges.
 *
 *  appData holds ONE JSON object. We own the `labels` key but MERGE on write so
 *  any other keys another feature may add are preserved. Versioned schema with
 *  tolerant parsing: empty / old / malformed appData → `{ labels: [] }`. */

import { convOfLine } from './xmtp';

/** Versioned shape we persist. Other keys may coexist in the same object. */
interface LabelsBlob {
  v: 1;
  labels: string[];
}

/** Caps — keep the blob tiny so it stays well inside MLS message limits. */
export const MAX_LABELS = 16;
export const MAX_LABEL_LEN = 24;

/** Thrown when updateAppData is rejected by group permissions. The UI surfaces
 *  `.message` inline. Shouldn't happen for all-members groups. */
export class LabelPermissionError extends Error {
  constructor() {
    super("You don't have permission to edit labels in this group.");
    this.name = 'LabelPermissionError';
  }
}

/** Minimal structural view of the XMTP Group methods we touch. */
interface GroupLike {
  sync?: () => Promise<unknown>;
  appData?: () => Promise<string>;
  updateAppData?: (appData: string) => Promise<void>;
}

function asGroup(conv: unknown): GroupLike | null {
  const g = conv as GroupLike;
  return g && typeof g.appData === 'function' && typeof g.updateAppData === 'function' ? g : null;
}

/** Normalise one label: trim, collapse inner whitespace, cap length. */
function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

/** Parse appData into a record, tolerating empty / malformed input. */
function parseBlob(appData: string): Record<string, unknown> {
  if (!appData || !appData.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(appData);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Pull a clean, deduped, capped label array out of a parsed blob. */
function readLabels(blob: Record<string, unknown>): string[] {
  const raw = blob['labels'];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const label = cleanLabel(item);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_LABELS) break;
  }
  return out;
}

/** Read the group's current labels. Syncs first for the latest committed state.
 *  Returns [] for DMs, missing groups, or any read error. */
export async function getGroupLabels(line: string): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) return [];
  try {
    await group.sync?.();
    const appData = await group.appData!();
    return readLabels(parseBlob(appData));
  } catch {
    return [];
  }
}

/** Read → mutate → write, merging into the existing appData object so we never
 *  clobber other keys. Returns the resulting label list. Throws
 *  LabelPermissionError when the write is permission-denied. */
async function mutate(line: string, fn: (labels: string[]) => string[]): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) throw new Error('Not a group conversation');
  await group.sync?.();
  const existing = parseBlob(await group.appData!());
  const next = readLabels({ ...existing, labels: fn(readLabels(existing)) });
  const blob: LabelsBlob & Record<string, unknown> = { ...existing, v: 1, labels: next };
  try {
    await group.updateAppData!(JSON.stringify(blob));
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('not authorized') || msg.includes('unauthorized')) {
      throw new LabelPermissionError();
    }
    throw e;
  }
  return next;
}

/** Add a label (trimmed, deduped case-insensitively, capped). No-op when the
 *  cleaned label is empty, already present, or the cap is reached. */
export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  const clean = cleanLabel(label);
  return mutate(line, (labels) => {
    if (!clean) return labels;
    if (labels.some((l) => l.toLowerCase() === clean.toLowerCase())) return labels;
    if (labels.length >= MAX_LABELS) return labels;
    return [...labels, clean];
  });
}

/** Remove a label by case-insensitive match. */
export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  const target = cleanLabel(label).toLowerCase();
  return mutate(line, (labels) => labels.filter((l) => l.toLowerCase() !== target));
}
