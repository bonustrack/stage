import { BackupElementSelectionOption, type ArchiveOptions, type Client } from '@xmtp/browser-sdk';
import { getCachedXmtpClient } from './xmtp.state.web';
import { getOrCreateXmtpClient } from './xmtp.client.web';

const ARCHIVE_LOOKBACK_DAYS = 30;

const ARCHIVE_OPTIONS: ArchiveOptions = {
  elements: [BackupElementSelectionOption.Messages, BackupElementSelectionOption.Consent],
  excludeDisappearingMessages: false,
};

type WebXmtpClient = Client<unknown>;

async function historyClient(): Promise<WebXmtpClient> {
  return getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
}

export async function requestHistorySync(): Promise<void> {
  const client = await historyClient();
  await client.sendSyncRequest(ARCHIVE_OPTIONS);
}

export async function sendHistoryArchive(pin: string): Promise<void> {
  const client = await historyClient();
  await client.sendSyncArchive(pin, ARCHIVE_OPTIONS);
}

export async function countAvailableHistoryArchives(): Promise<number> {
  const client = await historyClient();
  await client.syncAllDeviceSyncGroups();
  const archives = await client.listAvailableArchives(ARCHIVE_LOOKBACK_DAYS);
  return archives.length;
}

export async function processHistoryArchive(pin?: string): Promise<void> {
  const client = await historyClient();
  await client.processSyncArchive(pin ?? null);
}

export async function countLocalConversations(): Promise<number> {
  const client = await historyClient();
  const conversations = await client.conversations.list();
  return conversations.length;
}
