/** @file Group labels: read/write small free-form tags in the XMTP group's synced `appData` slot, owning the `labels` key but merging on write so other features' keys survive (versioned schema, tolerant parsing, all members may edit, E2E MLS-encrypted). */

import { convOfLine } from './xmtp';

/** Versioned shape we persist. Other keys may coexist in the same object. `github` is an optional linked GitHub issue/PR URL (Linear-style). */
interface LabelsBlob {
  v: 1;
  labels: string[];
  github?: string;
}

/** Max number of labels per group blob — caps keep the blob inside MLS message limits. */
export const MAX_LABELS = 16;
/** Max character length of a single label after cleaning. */
export const MAX_LABEL_LEN = 24;

/** Thrown when updateAppData is rejected by group permissions. The UI surfaces `.message` inline. Shouldn't happen for all-members groups. */
export class LabelPermissionError extends Error {
  /** Build the label-permission error with its fixed message and name. */
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

/** A GroupLike that has been verified to expose the appData read/write methods. */
export interface Group extends GroupLike {
  appData: () => Promise<string>;
  updateAppData: (appData: string) => Promise<void>;
}

/** Narrow a conversation to a Group if it exposes the appData read/write methods, else null. */
export function asGroup(conv: unknown): Group | null {
  const g = conv as GroupLike;
  return g && typeof g.appData === 'function' && typeof g.updateAppData === 'function'
    ? (g as Group)
    : null;
}

/** Normalise one label: trim, collapse inner whitespace, cap length. */
function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

/** Parse appData into a record, tolerating empty / malformed input. */
export function parseBlob(appData: string): Record<string, unknown> {
  if (!appData?.trim()) return {};
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
export function readLabels(blob: Record<string, unknown>): string[] {
  const raw = blob.labels;
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

/** Read the group's current labels. Syncs first for the latest committed state. Returns [] for DMs, missing groups, or any read error. */
export async function getGroupLabels(line: string): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) return [];
  try {
    await group.sync?.();
    const appData = await group.appData();
    return readLabels(parseBlob(appData));
  } catch {
    return [];
  }
}

/** Reads labels off an already-loaded group without forcing a fresh sync(), piggybacking on the channels list's per-row sync so rendering label chips never triggers an extra round-trip; returns [] for DMs, non-groups, or any read error. */
export async function labelsOfSyncedGroup(conv: unknown): Promise<string[]> {
  const group = asGroup(conv);
  if (!group) return [];
  try {
    return readLabels(parseBlob(await group.appData()));
  } catch {
    return [];
  }
}

/** Read → mutate → write, merging into the existing appData object so we never clobber other keys. Returns the resulting label list. Throws LabelPermissionError when the write is permission-denied. */
async function mutate(line: string, fn: (labels: string[]) => string[]): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) throw new Error('Not a group conversation');
  await group.sync?.();
  const existing = parseBlob(await group.appData());
  const next = readLabels({ ...existing, labels: fn(readLabels(existing)) });
  const blob: LabelsBlob & Record<string, unknown> = { ...existing, v: 1, labels: next };
  try {
    await group.updateAppData(JSON.stringify(blob));
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('not authorized') || msg.includes('unauthorized')) {
      throw new LabelPermissionError();
    }
    throw e;
  }
  return next;
}

/** Add a label (trimmed, deduped case-insensitively, capped). No-op when the cleaned label is empty, already present, or the cap is reached. */
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
