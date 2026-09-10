import type { Client } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient } from './xmtp.state';
import { getOrCreateXmtpClient } from './xmtp.client';

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
  await client.sendSyncArchive(pin);
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

export async function countLocalConversations(): Promise<number> {
  const client = await historyClient();
  const conversations = await client.conversations.list();
  return conversations.length;
}
