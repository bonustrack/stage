import {
  createGroupWith, addGroupMembersWith, requireValidMembers, currentMemberAddresses, updateGroupMetaWith, groupEditRightsOf, groupRoleOf,
  type CreateGroupResult, type GroupEditRights, type GroupMetaPatch,
} from '@stage-labs/client/xmtp/groups';
import { applyGroupMeta } from '@stage-labs/client/xmtp/channelsCache';
import {
  addLabel, asGroup, assignedAddresses, channelFieldOf, moveLabel, removeLabel, renameLabels, stringList, writeAssigned, writeChannelField,
  writeLabels, type ChannelField, type Group,
} from '@stage-labs/client/xmtp/labels';
import { convIdOfLine, lineOfConv } from '@stage-labs/client/xmtp/line';
import { getCachedRows, setCachedRows, type CachedRow } from './channelsCache';
import { convOfLine, sdk } from './xmtp.sdk';
import { notAGroup } from './xmtp.sdk.core';
import { groupRowMeta } from '../modules/messaging/conversation';
import { report, reported } from './errorPolicy';
import { getActiveAccount } from './accounts';
import { setChannelHidden } from './hiddenChannels';

type GroupConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

function requireConv<T>(conv: T | null): T {
  if (!conv) throw new Error('Conversation not found');
  return conv;
}

async function requireGroup(line: string): Promise<GroupConv> {
  const conv = requireConv(await convOfLine(line));
  return sdk.isGroup(conv) ? conv : notAGroup();
}

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

export async function createGroup(addresses: string[]): Promise<CreateGroupResult> {
  const client = await sdk.client();
  return createGroupWith(
    addresses, lineOfConv, (members) => sdk.newGroup(client, members, {}), (address) => sdk.inboxIdOfAddress(client, address),
  );
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try {
    requireValidMembers(addresses);
    const group = await requireGroup(lineOfConv(convId));
    await addGroupMembersWith(addresses, (members) => sdk.addMembers(group, members));
  } finally {
    refreshGroupRow(convId);
  }
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  try {
    const group = await requireGroup(lineOfConv(convId));
    await sdk.removeMembers(group, addresses);
  } finally {
    refreshGroupRow(convId);
  }
}

export async function updateGroupMeta(convId: string, patch: GroupMetaPatch): Promise<void> {
  try {
    const ops = sdk.groupOps(requireConv(await convOfLine(lineOfConv(convId)))) ?? notAGroup();
    await updateGroupMetaWith(patch, ops);
  } finally {
    refreshGroupRow(convId);
  }
}

export async function updateGroupAssigned(convId: string, assigned: string[]): Promise<string[]> {
  try {
    const conv = await requireGroup(lineOfConv(convId));
    const group = asGroup(conv) ?? notAGroup();
    return await writeAssigned(group, assigned, async () => {
      const client = await sdk.client();
      const members = await conv.members();
      return currentMemberAddresses(assignedAddresses(assigned), members.map(member => member.inboxId), address => sdk.inboxIdOfAddress(client, address));
    });
  } finally {
    refreshGroupRow(convId);
  }
}

export async function groupEditRights(convId: string): Promise<GroupEditRights> {
  const group = await requireGroup(lineOfConv(convId));
  const [client, policy, staff] = await Promise.all([sdk.client(), sdk.groupMetaPolicy(group), sdk.groupAdmins(group)]);
  return groupEditRightsOf(policy, groupRoleOf(client.inboxId ?? '', staff));
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const account = requireConv(await getActiveAccount());
  const conv = await requireGroup(line);
  await setChannelHidden(account.id, conv.id, true);
  const leave = sdk.leaveOp(conv);
  let result: 'left' | 'hidden' = 'hidden';
  if (leave) {
    try {
      await leave();
      result = 'left';
    } catch (err) {
      report('xmtp.leaveGroup', err);
    }
  }
  await sdk.setConsent(conv, 'denied').catch(reported('xmtp.leaveGroupConsent'));
  return result;
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

export async function setGroupField(line: string, field: ChannelField, value: string | null): Promise<string | null> {
  const convId = convIdOfLine(line);
  patchRow(convId, () => ({ [field]: channelFieldOf(field, value) }));
  try { return await writeChannelField(await groupOfLine(line), field, value); } finally { refreshGroupRow(convId); }
}

export function setGroupCategory(line: string, category: string | null): Promise<string | null> {
  return setGroupField(line, 'category', category);
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

export function knownChannelFields(field: ChannelField): string[] {
  return knownTags(row => {
    const value = channelFieldOf(field, row[field]);
    return value === null ? [] : [value];
  });
}

export function knownCategories(): string[] {
  return knownChannelFields('category');
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
