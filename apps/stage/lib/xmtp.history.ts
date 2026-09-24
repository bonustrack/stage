import { sdk } from './xmtp.sdk';
import { historyServer } from './historyServer';

export async function requestHistorySync(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.sendSyncRequest(client, await historyServer());
}

export async function syncHistoryGroups(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.syncDeviceGroups(client);
}

export async function processHistoryArchive(): Promise<void> {
  const client = await sdk.client();
  await sdk.history.processSyncArchive(client);
}

export async function createHistoryArchive(key: Uint8Array): Promise<Uint8Array> {
  const client = await sdk.client();
  return sdk.history.createArchive(client, key);
}

export async function importHistoryArchive(archive: Uint8Array, key: Uint8Array): Promise<void> {
  const client = await sdk.client();
  await sdk.history.importArchive(client, archive, key);
}
