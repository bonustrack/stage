import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { isSyncGroupName, syncGroupName, type SyncGroupState } from '@stage-labs/client/xmtp/readState';
import { convOfLine, sdk } from './xmtp.sdk';
import { lineOfConv } from './xmtp.types';
import { recover } from './errorPolicy';

type SyncConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function conversationIsSyncGroup(conv: SyncConv): Promise<boolean> {
  return isSyncGroupName(await sdk.groupName(conv));
}

export async function listSyncGroups(): Promise<SyncGroupState[]> {
  const all = await sdk.listConvs(await sdk.client());
  const out: SyncGroupState[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    const active = await sdk.isActive(conv).catch(recover('readSync.isActive', false));
    out.push({ id: conv.id, createdAtNs: sdk.createdAtNs(conv), active });
  }
  return out;
}

export async function isOwnSyncGroup(convId: string, address: string): Promise<boolean> {
  const conv = await convOfLine(lineOfConv(convId));
  if (conv?.id !== convId || (await sdk.groupName(conv)) !== syncGroupName(address)) return false;
  const selfInboxId = (await sdk.client()).inboxId;
  return (await conv.members()).every((m) => m.inboxId === selfInboxId);
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

export async function syncMessagesPage(
  convId: string, limit: number, beforeMs: number | undefined,
): Promise<StreamedMessage[]> {
  const conv = await requireConv(convId);
  return (await sdk.messages(conv, { limit, order: 'desc', beforeMs })).map(sdk.rowOf);
}
