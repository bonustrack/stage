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
  appData?: (() => Promise<string>) | string;
  updateAppData?: (appData: string) => Promise<void>;
}

export interface Group extends GroupLike {
  updateAppData: (appData: string) => Promise<void>;
}

export function asGroup(conv: unknown): Group | null {
  const g = conv as GroupLike;
  const readableAppData =
    typeof g?.appData === 'function' || typeof g?.appData === 'string' || g?.appData === undefined;
  return g && typeof g.updateAppData === 'function' && readableAppData
    ? (g as Group)
    : null;
}

async function readAppData(group: Group): Promise<string> {
  if (typeof group.appData === 'function') return await group.appData() ?? '';
  return group.appData ?? '';
}

function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

function parseBlob(appData: string): Record<string, unknown> {
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

function readLabels(blob: Record<string, unknown>): string[] {
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

export async function groupLabelsOf(conv: unknown, sync = false): Promise<string[]> {
  const group = asGroup(conv);
  if (!group) return [];
  try {
    if (sync) await group.sync?.();
    return readLabels(parseBlob(await readAppData(group)));
  } catch {
    return [];
  }
}

function isLabelPermissionDenied(e: unknown): boolean {
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

export function moveLabel(labels: string[], from: string | null, to: string | null): string[] {
  if (to === null) return [];
  return addLabel(from === null ? labels : removeLabel(labels, from), to);
}

export function renameLabels(labels: string[], from: string, to: string): string[] {
  const clean = cleanLabel(to);
  const names = new Set([from, clean].map((name) => cleanLabel(name).toLowerCase()));
  const at = labels.findIndex((l) => names.has(l.toLowerCase()));
  if (!clean || at === -1) return labels;
  return labels.flatMap((l, i) => {
    if (i === at) return [clean];
    return names.has(l.toLowerCase()) ? [] : [l];
  });
}

export async function writeLabels(
  group: Group,
  fn: (labels: string[]) => string[],
): Promise<string[]> {
  await group.sync?.();
  const existing = parseBlob(await readAppData(group));
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
