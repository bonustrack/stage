export interface LabelsBlob {
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

export function cleanLabel(raw: string): string {
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

export function labelsOfSyncedGroup(conv: unknown): Promise<string[]> {
  const group = asGroup(conv);
  if (!group) return Promise.resolve([]);
  return (async (): Promise<string[]> => {
    try {
      return readLabels(parseBlob(await group.appData()));
    } catch {
      return [];
    }
  })();
}

export function isLabelPermissionDenied(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return msg.includes('permission') || msg.includes('not authorized') || msg.includes('unauthorized');
}

export function addLabel(labels: string[], label: string): string[] {
  const clean = cleanLabel(label);
  if (!clean) return labels;
  if (labels.some((l) => l.toLowerCase() === clean.toLowerCase())) return labels;
  if (labels.length >= MAX_LABELS) return labels;
  return [...labels, clean];
}

export function removeLabel(labels: string[], label: string): string[] {
  const target = cleanLabel(label).toLowerCase();
  return labels.filter((l) => l.toLowerCase() !== target);
}

export async function writeLabels(
  group: Group,
  fn: (labels: string[]) => string[],
): Promise<string[]> {
  await group.sync?.();
  const existing = parseBlob(await group.appData());
  const next = readLabels({ ...existing, labels: fn(readLabels(existing)) });
  const blob: LabelsBlob & Record<string, unknown> = { ...existing, v: 1, labels: next };
  try {
    await group.updateAppData(JSON.stringify(blob));
  } catch (e) {
    if (isLabelPermissionDenied(e)) throw new LabelPermissionError();
    throw e;
  }
  return next;
}
