import { SortDirection, type Conversation } from '@xmtp/browser-sdk';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import {
  isSyncGroupName, type PinStateContent, type ReadStateContent, type SyncGroupCandidate,
} from '@stage-labs/client/xmtp/readState';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client.web';
import { lineOfConv } from './xmtp.types.web';
import { PIN_STATE_CODEC, READ_STATE_CODEC } from './xmtpJsonCodecs';

async function client(): ReturnType<typeof getOrCreateXmtpClient> {
  return getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
}

export function conversationIsSyncGroup(conv: unknown): Promise<boolean> {
  const group = conv as { name?: unknown };
  return Promise.resolve(isSyncGroupName(group.name));
}

export async function listSyncGroups(): Promise<SyncGroupCandidate[]> {
  const all = await (await client()).conversations.list();
  const out: SyncGroupCandidate[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    const createdAtNs = (conv as { createdAtNs?: bigint }).createdAtNs;
    out.push({ id: conv.id, createdAtNs: createdAtNs === undefined ? 0 : Number(createdAtNs) });
  }
  return out;
}

export async function createSyncGroup(name: string): Promise<string> {
  const group = await (await client()).conversations.createGroupWithIdentifiers([], { groupName: name });
  return group.id;
}

async function requireConv(convId: string): Promise<Conversation> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Sync conversation not found');
  return conv;
}

export async function sendReadState(convId: string, content: ReadStateContent): Promise<void> {
  const conv = await requireConv(convId);
  await conv.send(READ_STATE_CODEC.encode(content));
}

export async function sendPinState(convId: string, content: PinStateContent): Promise<void> {
  const conv = await requireConv(convId);
  await conv.send(PIN_STATE_CODEC.encode(content));
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
