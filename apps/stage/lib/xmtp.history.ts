import type { Client } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient } from './xmtp.state';
import { getOrCreateXmtpClient } from './xmtp.client';
import { snapshotOf, type HistorySnapshot } from './historySync.model';
import { historyServerUrl } from './historyServer';
import { secureStorage } from '../platform/storage';

const ENV_KEY = 'xmtp.env';

async function historyServer(): Promise<string> {
  const env = await secureStorage.get(ENV_KEY).catch(() => null);
  return historyServerUrl(env ?? 'production');
}

const ARCHIVE_LOOKBACK_DAYS = 30;

async function historyClient(): Promise<Client> {
  return getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
}

export async function requestHistorySync(): Promise<void> {
  const client = await historyClient();
  await client.sendSyncRequest();
}

export async function sendHistoryArchive(pin: string): Promise<void> {
  const client = await historyClient();
  await client.sendSyncArchive(pin, await historyServer());
}

export async function countAvailableHistoryArchives(): Promise<number> {
  const client = await historyClient();
  await client.syncAllDeviceSyncGroups();
  const archives = await client.listAvailableArchives(ARCHIVE_LOOKBACK_DAYS);
  return archives.length;
}

export async function processHistoryArchive(pin?: string): Promise<void> {
  const client = await historyClient();
  await client.processSyncArchive(pin);
}

export async function historySnapshot(): Promise<HistorySnapshot> {
  const client = await historyClient();
  const conversations = await client.conversations.list();
  const entries = await Promise.all(conversations.map(async (conversation) => {
    const [first] = await conversation.messages({ limit: 1, direction: 'ASCENDING' });
    return { id: conversation.id, firstNs: first === undefined ? '' : String(first.sentNs) };
  }));
  return snapshotOf(entries);
}
