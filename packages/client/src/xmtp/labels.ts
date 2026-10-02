import { validMemberAddresses } from './groups';

export const MAX_LABELS = 16;
export const MAX_LABEL_LEN = 24;

export class LabelPermissionError extends Error {
  constructor(what = 'labels') {
    super(`You don't have permission to edit ${what} in this channel.`);
    this.name = 'LabelPermissionError';
  }
}

interface GroupLike {
  id?: string;
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

export function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_LEN);
}

export function parseObject(raw: string | undefined): Record<string, unknown> | null {
  if (raw === undefined) return null;
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function parseBlob(appData: string): Record<string, unknown> {
  return parseObject(appData) ?? {};
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

export function categoryOf(value: unknown): string | null {
  return typeof value === 'string' ? cleanLabel(value) || null : null;
}

export interface GroupTags { labels: string[]; category: string | null }

const NO_TAGS: GroupTags = { labels: [], category: null };

export async function groupTagsOf(conv: unknown): Promise<GroupTags> {
  const group = asGroup(conv);
  if (!group) return NO_TAGS;
  try {
    const blob = parseBlob(await readAppData(group));
    return { labels: readLabels(blob), category: categoryOf(blob.category) };
  } catch {
    return NO_TAGS;
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

const appDataWrites = new Map<string | Group, Promise<void>>();
let appDataEpoch = 0;

export function clearAppDataWrites(): void {
  appDataEpoch += 1;
  appDataWrites.clear();
}

async function writeBlob(group: Group, patch: (blob: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<void> {
  const key = group.id ?? group;
  const previous = appDataWrites.get(key);
  const epoch = appDataEpoch;
  const task = async (): Promise<void> => {
    if (epoch !== appDataEpoch) throw new Error('Channel edit canceled.');
    await group.sync?.();
    const existing = parseBlob(await readAppData(group));
    const changed = await patch(existing);
    const latest = parseBlob(await readAppData(group));
    if (epoch !== appDataEpoch) throw new Error('Channel edit canceled.');
    await group.updateAppData(JSON.stringify({ ...latest, v: 1, ...changed }));
  };
  const pending = previous ? previous.then(task, task) : task();
  appDataWrites.set(key, pending);
  try { await pending; } finally {
    if (appDataWrites.get(key) === pending) appDataWrites.delete(key);
  }
}

async function writeTags(group: Group, what: string, patch: (blob: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  try {
    await writeBlob(group, (existing) => Promise.resolve(patch(existing)));
  } catch (e) {
    if (isLabelPermissionDenied(e)) throw new LabelPermissionError(what);
    throw e;
  }
}

export async function writeLabels(
  group: Group,
  fn: (labels: string[]) => string[],
): Promise<string[]> {
  let next: string[] = [];
  await writeTags(group, 'labels', (existing) => {
    next = readLabels({ labels: fn(readLabels(existing)) });
    return { labels: next };
  });
  return next;
}

export async function writeCategory(group: Group, category: string | null): Promise<string | null> {
  const next = categoryOf(category);
  await writeTags(group, 'the category', () => ({ category: next ?? undefined }));
  return next;
}

export function assignedAddresses(value: unknown): string[] {
  return [...new Set(validMemberAddresses(stringList(value)).map(address => address.toLowerCase()))];
}

export async function groupAssignedOf(conv: unknown): Promise<string[]> {
  const group = asGroup(conv);
  return group ? assignedAddresses(parseBlob(await readAppData(group)).assigned) : [];
}

export async function writeAssigned(group: Group, assigned: string[], members: () => Promise<string[]>): Promise<string[]> {
  const next = assignedAddresses(assigned);
  if (next.length !== new Set(assigned.map(address => address.trim().toLowerCase())).size) {
    throw new Error('Choose valid channel members.');
  }
  await writeBlob(group, async () => {
    const current = new Set(assignedAddresses(await members()));
    if (next.some(address => !current.has(address))) throw new Error('Assignees must be current channel members.');
    return { assigned: next };
  });
  return next;
}
