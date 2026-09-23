import { sdk } from './xmtp.sdk';
import { snapshotOf, type HistorySnapshot } from './historySync.model';
import { historyServer } from './historyServer';

const ARCHIVE_LOOKBACK_DAYS = 30;

export async function requestHistorySync(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncRequest(client);
}

export async function sendHistoryArchive(pin: string): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncArchive(client, pin, await historyServer());
}

export async function countAvailableHistoryArchives(): Promise<number> {
  const client = await sdk.client();
  await sdk.history.syncDeviceGroups(client);
  return sdk.history.countArchives(client, ARCHIVE_LOOKBACK_DAYS);
}

export async function processHistoryArchive(pin?: string): Promise<void> {
  const client = await sdk.client();
  await sdk.history.processSyncArchive(client, pin);
}

export async function historySnapshot(): Promise<HistorySnapshot> {
  const client = await sdk.client();
  const conversations = await sdk.listConvs(client);
  const entries = await Promise.all(conversations.map(async (conversation) => {
    const [first] = await sdk.messages(conversation, { limit: 1, order: 'asc' });
    return { id: conversation.id, firstNs: first === undefined ? '' : sdk.sentNsText(first) };
  }));
  return snapshotOf(entries);
}
