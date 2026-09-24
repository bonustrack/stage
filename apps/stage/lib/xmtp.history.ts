import { sdk } from './xmtp.sdk';
import { historyServer } from './historyServer';

export async function requestHistorySync(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncRequest(client, await historyServer());
}

export async function sendHistoryArchive(pin: string): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncArchive(client, pin, await historyServer());
}

export async function syncHistoryGroups(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.syncDeviceGroups(client);
}

export async function processHistoryArchive(pin?: string): Promise<void> {
  const client = await sdk.client();
  await sdk.history.processSyncArchive(client, pin);
}
