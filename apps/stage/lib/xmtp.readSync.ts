import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import {
  isSyncGroupName, type SyncGroupCandidate,
} from '@stage-labs/client/xmtp/readState';
import { convOfLine, xmtpClient } from './xmtp.client';
import { lineOfConv } from './xmtp.types';

export async function conversationIsSyncGroup(conv: unknown): Promise<boolean> {
  const group = conv as { name?: () => Promise<string> };
  const name = await (group.name?.().catch(() => '') ?? Promise.resolve(''));
  return isSyncGroupName(name);
}

export async function listSyncGroups(): Promise<SyncGroupCandidate[]> {
  const all = await (await xmtpClient()).conversations.list();
  const out: SyncGroupCandidate[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    const createdAtMs = (conv as { createdAt?: number }).createdAt ?? 0;
    out.push({ id: conv.id, createdAtNs: createdAtMs * 1_000_000 });
  }
  return out;
}

export async function createSyncGroup(name: string): Promise<string> {
  const group = await (await xmtpClient()).conversations.newGroupWithIdentities([], { name });
  return group.id;
}

async function requireConv(convId: string): Promise<NonNullable<Awaited<ReturnType<typeof convOfLine>>>> {
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
  const messages = await conv.messages({ limit, direction: 'DESCENDING' });
  return messages.map((m) => {
    let content: unknown;
    try { content = m.content(); } catch { content = undefined; }
    return { content, contentTypeId: m.contentTypeId, senderInboxId: m.senderInboxId, sentNs: m.sentNs };
  });
}
