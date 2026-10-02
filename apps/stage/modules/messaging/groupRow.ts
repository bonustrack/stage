import { applyGroupMeta } from '@stage-labs/client/xmtp/channelsCache';
import {
  addLabel, asGroup, categoryOf, moveLabel, removeLabel, renameLabels, stringList, writeCategory, writeLabels,
  type Group,
} from '@stage-labs/client/xmtp/labels';
import { getCachedRows, setCachedRows, type CachedRow } from '../../lib/channelsCache';
import { reported } from '../../lib/errorPolicy';
import {
  addGroupMembers as addMembers, removeGroupMembers as removeMembers, updateGroupMeta as updateMeta,
  updateGroupAssigned as updateAssigned,
} from '../../lib/xmtp.groups';
import { convOfLine } from '../../lib/xmtp.sdk';
import { convIdOfLine, lineOfConv } from '../../lib/xmtp.types';
import { groupRowMeta } from './conversation';

const latestRefresh = new Map<string, number>();
let refreshSeq = 0;

function hasGroupRow(convId: string): boolean {
  return getCachedRows()?.some(r => r.convId === convId && r.peerAddress == null) ?? false;
}

async function loadGroupRow(convId: string, seq: number): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  const meta = conv ? await groupRowMeta(conv) : null;
  if (latestRefresh.get(convId) !== seq) return;
  latestRefresh.delete(convId);
  const next = meta ? applyGroupMeta(getCachedRows() ?? [], convId, meta) : null;
  if (next) setCachedRows(next);
}

export function refreshGroupRow(convId: string | null): void {
  if (!convId || !hasGroupRow(convId)) return;
  refreshSeq += 1;
  latestRefresh.set(convId, refreshSeq);
  void loadGroupRow(convId, refreshSeq).catch(reported('messaging.refreshGroupRow'));
}

function patchRow(convId: string | null, patch: (row: CachedRow) => Partial<CachedRow>): void {
  const rows = getCachedRows();
  const cur = rows?.find(r => r.convId === convId);
  if (!rows || !cur) return;
  setCachedRows(rows.map(r => (r === cur ? { ...r, ...patch(r) } : r)));
}

function patchRowLabels(convId: string | null, next: (labels: string[]) => string[]): void {
  patchRow(convId, r => ({ labels: next(stringList(r.labels)) }));
}

interface LabelWrites { base: string[]; pending: number; failed: boolean }
const labelWrites = new Map<string, LabelWrites>();

function startLabelWrite(convId: string | null): LabelWrites | null {
  if (convId === null) return null;
  let writes = labelWrites.get(convId);
  if (!writes) {
    const row = getCachedRows()?.find(r => r.convId === convId);
    if (!row) return null;
    writes = { base: stringList(row.labels), pending: 0, failed: false };
    labelWrites.set(convId, writes);
  }
  writes.pending += 1;
  return writes;
}

function settleLabelWrite(convId: string | null, writes: LabelWrites | null): void {
  if (convId === null || writes === null) return;
  writes.pending -= 1;
  if (writes.pending > 0) return;
  labelWrites.delete(convId);
  if (writes.failed) patchRowLabels(convId, () => writes.base);
}

async function groupOfLine(line: string): Promise<Group> {
  const group = asGroup(await convOfLine(line));
  if (!group) throw new Error('Not a channel');
  return group;
}

async function writeGroupLabels(line: string, fn: (labels: string[]) => string[]): Promise<string[]> {
  return writeLabels(await groupOfLine(line), fn);
}

async function writeRowLabels(line: string, next: (labels: string[]) => string[]): Promise<string[]> {
  const convId = convIdOfLine(line);
  const writes = startLabelWrite(convId);
  patchRowLabels(convId, next);
  try {
    const written = await writeGroupLabels(line, next);
    if (writes) writes.base = written;
    return written;
  } catch (err) {
    if (writes) writes.failed = true;
    throw err;
  } finally {
    settleLabelWrite(convId, writes);
    refreshGroupRow(convId);
  }
}

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => addLabel(labels, label));
}

export async function moveGroupLabel(line: string, from: string | null, to: string | null): Promise<string[]> {
  return writeRowLabels(line, (labels) => moveLabel(labels, from, to));
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => removeLabel(labels, label));
}

export async function renameGroupLabel(line: string, from: string, to: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => renameLabels(labels, from, to));
}

export async function setGroupCategory(line: string, category: string | null): Promise<string | null> {
  const convId = convIdOfLine(line);
  patchRow(convId, () => ({ category: categoryOf(category) }));
  try { return await writeCategory(await groupOfLine(line), category); } finally { refreshGroupRow(convId); }
}

function knownTags(tagsOf: (row: CachedRow) => string[]): string[] {
  const rows = getCachedRows();
  if (!rows) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const tag of tagsOf(row)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function knownCategories(): string[] {
  return knownTags(row => {
    const category = categoryOf(row.category);
    return category === null ? [] : [category];
  });
}

export function suggestLabels(query: string, applied: string[]): string[] {
  const appliedKeys = new Set(applied.map((l) => l.toLowerCase()));
  const q = query.trim().toLowerCase();
  return knownTags(row => stringList(row.labels)).filter((label) => {
    const key = label.toLowerCase();
    if (appliedKeys.has(key)) return false;
    if (!q) return true;
    if (key === q) return false;
    return key.includes(q);
  });
}

export async function updateGroupMeta(convId: string, patch: Parameters<typeof updateMeta>[1]): Promise<void> {
  try { await updateMeta(convId, patch); } finally { refreshGroupRow(convId); }
}

export async function updateGroupAssigned(convId: string, assigned: string[]): Promise<string[]> {
  try { return await updateAssigned(convId, assigned); } finally { refreshGroupRow(convId); }
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try { await addMembers(convId, addresses); } finally { refreshGroupRow(convId); }
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try { await removeMembers(convId, addresses); } finally { refreshGroupRow(convId); }
}
