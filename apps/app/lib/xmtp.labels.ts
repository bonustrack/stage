
import { convOfLine } from './xmtp';

interface LabelsBlob {
  v: 1;
  labels: string[];
  github?: string;
}

export const MAX_LABELS = 16;
export const MAX_LABEL_LEN = 24;

export class LabelPermissionError extends Error {
  constructor() {
    super("You don't have permission to edit labels in this group.");
    this.name = 'LabelPermissionError';
  }
}

interface GroupLike {
  sync?: () => Promise<unknown>;
  appData?: () => Promise<string>;
  updateAppData?: (appData: string) => Promise<void>;
}

export interface Group extends GroupLike {
  appData: () => Promise<string>;
  updateAppData: (appData: string) => Promise<void>;
}

export function asGroup(conv: unknown): Group | null {
  const g = conv as GroupLike;
  return g && typeof g.appData === 'function' && typeof g.updateAppData === 'function'
    ? (g as Group)
    : null;
}

function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

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

export async function labelsOfSyncedGroup(conv: unknown): Promise<string[]> {
  const group = asGroup(conv);
  if (!group) return [];
  try {
    return readLabels(parseBlob(await group.appData()));
  } catch {
    return [];
  }
}

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

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  const clean = cleanLabel(label);
  return mutate(line, (labels) => {
    if (!clean) return labels;
    if (labels.some((l) => l.toLowerCase() === clean.toLowerCase())) return labels;
    if (labels.length >= MAX_LABELS) return labels;
    return [...labels, clean];
  });
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  const target = cleanLabel(label).toLowerCase();
  return mutate(line, (labels) => labels.filter((l) => l.toLowerCase() !== target));
}
