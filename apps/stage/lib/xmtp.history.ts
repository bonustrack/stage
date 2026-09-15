import { xmtpClient } from './xmtp.client';
import { snapshotOf, type HistorySnapshot } from './historySync.model';
import { historyServer } from './historyServer';

const ARCHIVE_LOOKBACK_DAYS = 30;


export async function requestHistorySync(): Promise<void> {
  const client = await xmtpClient();
  await client.sendSyncRequest();
}

export async function sendHistoryArchive(pin: string): Promise<void> {
  const client = await xmtpClient();
  await client.sendSyncArchive(pin, await historyServer());
}

export async function countAvailableHistoryArchives(): Promise<number> {
  const client = await xmtpClient();
  await client.syncAllDeviceSyncGroups();
  const archives = await client.listAvailableArchives(ARCHIVE_LOOKBACK_DAYS);
  return archives.length;
}

export async function processHistoryArchive(pin?: string): Promise<void> {
  const client = await xmtpClient();
  await client.processSyncArchive(pin);
}

export async function historySnapshot(): Promise<HistorySnapshot> {
  const client = await xmtpClient();
  const conversations = await client.conversations.list();
  const entries = await Promise.all(conversations.map(async (conversation) => {
    const [first] = await conversation.messages({ limit: 1, direction: 'ASCENDING' });
    return { id: conversation.id, firstNs: first === undefined ? '' : String(first.sentNs) };
  }));
  return snapshotOf(entries);
}
