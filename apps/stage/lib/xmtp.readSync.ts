import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { isSyncGroupName, type SyncGroupCandidate } from '@stage-labs/client/xmtp/readState';
import { convOfLine, sdk } from './xmtp.sdk';
import { lineOfConv } from './xmtp.types';

type SyncConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function conversationIsSyncGroup(conv: SyncConv): Promise<boolean> {
  return isSyncGroupName(await sdk.groupName(conv));
}

export async function listSyncGroups(): Promise<SyncGroupCandidate[]> {
  const all = await sdk.listConvs(await sdk.client());
  const out: SyncGroupCandidate[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    out.push({ id: conv.id, createdAtNs: sdk.createdAtNs(conv) });
  }
  return out;
}

export async function createSyncGroup(name: string): Promise<string> {
  const group = await sdk.newGroup(await sdk.client(), [], { name });
  return group.id;
}

async function requireConv(convId: string): Promise<SyncConv> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Sync conversation not found');
  return conv;
}

export async function syncConversation(convId: string): Promise<void> {
  const conv = await requireConv(convId);
  await conv.sync();
}

export async function recentSyncMessages(convId: string, limit: number): Promise<RowMessage[]> {
  const conv = await requireConv(convId);
  return (await sdk.messages(conv, { limit, order: 'desc' })).map(sdk.rowOf);
}
