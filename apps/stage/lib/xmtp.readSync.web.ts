import { SortDirection, type Conversation } from '@xmtp/browser-sdk';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import {
  isSyncGroupName, type SyncGroupCandidate,
} from '@stage-labs/client/xmtp/readState';
import { convOfLine, xmtpClient } from './xmtp.client.web';
import { lineOfConv } from './xmtp.types';

export function conversationIsSyncGroup(conv: unknown): Promise<boolean> {
  const group = conv as { name?: unknown };
  return Promise.resolve(isSyncGroupName(group.name));
}

export async function listSyncGroups(): Promise<SyncGroupCandidate[]> {
  const all = await (await xmtpClient()).conversations.list();
  const out: SyncGroupCandidate[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    const createdAtNs = (conv as { createdAtNs?: bigint }).createdAtNs;
    out.push({ id: conv.id, createdAtNs: createdAtNs === undefined ? 0 : Number(createdAtNs) });
  }
  return out;
}

export async function createSyncGroup(name: string): Promise<string> {
  const group = await (await xmtpClient()).conversations.createGroupWithIdentifiers([], { groupName: name });
  return group.id;
}

async function requireConv(convId: string): Promise<Conversation> {
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
  const messages = await conv.messages({ limit: BigInt(limit), direction: SortDirection.Descending });
  return messages.map((m) => ({
    content: m.content,
    contentTypeId: m.contentType.typeId,
    senderInboxId: m.senderInboxId,
    sentNs: Number(m.sentAtNs),
  }));
}
