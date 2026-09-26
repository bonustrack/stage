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

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  const convId = convIdOfLine(line);
  patchRowLabels(convId, (labels) => withLabel(labels, label));
  try { return await addLabel(line, label); } finally { refreshGroupRow(convId); }
}

export async function moveGroupLabel(line: string, from: string | null, to: string | null): Promise<string[]> {
  const convId = convIdOfLine(line);
  patchRowLabels(convId, (labels) => moveLabel(labels, from, to));
  try { return await moveRemoteLabel(line, from, to); } finally { refreshGroupRow(convId); }
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  const convId = convIdOfLine(line);
  patchRowLabels(convId, (labels) => withoutLabel(labels, label));
  try { return await removeLabel(line, label); } finally { refreshGroupRow(convId); }
}

export async function renameGroupLabel(line: string, from: string, to: string): Promise<string[]> {
  const convId = convIdOfLine(line);
  patchRowLabels(convId, (labels) => renameLabels(labels, from, to));
  try { return await renameRemoteLabel(line, from, to); } finally { refreshGroupRow(convId); }
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
