import { applyGroupMeta } from '@stage-labs/client/xmtp/channelsCache';
import { getCachedRows, setCachedRows } from '../../lib/channelsCache';
import { reported } from '../../lib/errorPolicy';
import {
  addGroupMembers as addMembers, removeGroupMembers as removeMembers, updateGroupMeta as updateMeta,
} from '../../lib/xmtp.groups';
import { addGroupLabel as addLabel, removeGroupLabel as removeLabel } from '../../lib/xmtp.labels';
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

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  try { return await addLabel(line, label); } finally { refreshGroupRow(convIdOfLine(line)); }
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  try { return await removeLabel(line, label); } finally { refreshGroupRow(convIdOfLine(line)); }
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
