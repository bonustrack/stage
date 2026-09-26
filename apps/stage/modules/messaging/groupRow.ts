import { applyGroupMeta } from '@stage-labs/client/xmtp/channelsCache';
import {
  addLabel as withLabel, moveLabel, removeLabel as withoutLabel, renameLabels,
} from '@stage-labs/client/xmtp/labels';
import { getCachedRows, setCachedRows } from '../../lib/channelsCache';
import { reported } from '../../lib/errorPolicy';
import {
  addGroupMembers as addMembers, removeGroupMembers as removeMembers, updateGroupMeta as updateMeta,
} from '../../lib/xmtp.groups';
import {
  addGroupLabel as addLabel, moveGroupLabel as moveRemoteLabel, removeGroupLabel as removeLabel,
  renameGroupLabel as renameRemoteLabel,
} from '../../lib/xmtp.labels';
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

function rowLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((l): l is string => typeof l === 'string') : [];
}

function patchRowLabels(convId: string | null, next: (labels: string[]) => string[]): void {
  const rows = getCachedRows();
  const cur = rows?.find(r => r.convId === convId);
  if (!rows || !cur) return;
  setCachedRows(rows.map(r => (r === cur ? { ...r, labels: next(rowLabels(r.labels)) } : r)));
}

interface LabelWrites { base: string[]; pending: number; failed: boolean }
const labelWrites = new Map<string, LabelWrites>();

function startLabelWrite(convId: string | null): LabelWrites | null {
  if (convId === null) return null;
  const known = labelWrites.get(convId);
  if (known) {
    known.pending += 1;
    return known;
  }
  const row = getCachedRows()?.find(r => r.convId === convId);
  if (!row) return null;
  const started = { base: rowLabels(row.labels), pending: 1, failed: false };
  labelWrites.set(convId, started);
  return started;
}

function settleLabelWrite(convId: string | null, writes: LabelWrites | null): void {
  if (convId === null || writes === null) return;
  writes.pending -= 1;
  if (writes.pending > 0) return;
  labelWrites.delete(convId);
  if (writes.failed) patchRowLabels(convId, () => writes.base);
}

async function writeRowLabels(
  line: string, next: (labels: string[]) => string[], write: () => Promise<string[]>,
): Promise<string[]> {
  const convId = convIdOfLine(line);
  const writes = startLabelWrite(convId);
  patchRowLabels(convId, next);
  try {
    return await write();
  } catch (err) {
    if (writes) writes.failed = true;
    throw err;
  } finally {
    settleLabelWrite(convId, writes);
    refreshGroupRow(convId);
  }
}

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => withLabel(labels, label), () => addLabel(line, label));
}

export async function moveGroupLabel(line: string, from: string | null, to: string | null): Promise<string[]> {
  return writeRowLabels(line, (labels) => moveLabel(labels, from, to), () => moveRemoteLabel(line, from, to));
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => withoutLabel(labels, label), () => removeLabel(line, label));
}

export async function renameGroupLabel(line: string, from: string, to: string): Promise<string[]> {
  return writeRowLabels(line, (labels) => renameLabels(labels, from, to), () => renameRemoteLabel(line, from, to));
}

export async function updateGroupMeta(convId: string, patch: Parameters<typeof updateMeta>[1]): Promise<void> {
  try { await updateMeta(convId, patch); } finally { refreshGroupRow(convId); }
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try { await addMembers(convId, addresses); } finally { refreshGroupRow(convId); }
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try { await removeMembers(convId, addresses); } finally { refreshGroupRow(convId); }
}
