import { parsePendingSetup, type PendingSetup } from '@stage-labs/client/profile/setup';
import { appStorage } from '../platform/storage';
import { makeListeners } from './storeCore';

const KEY = 'onboarding.pending.v1';
const changes = makeListeners();
export const subscribePendingSetup = changes.subscribe;

export async function readPendingSetup(): Promise<PendingSetup | null> {
  const raw = await appStorage.get(KEY);
  return raw === null ? null : parsePendingSetup(raw);
}

export async function writePendingSetup(pending: PendingSetup): Promise<void> {
  const checked = parsePendingSetup(JSON.stringify(pending));
  await appStorage.set(KEY, JSON.stringify(checked));
  changes.notify();
}

export async function clearPendingSetup(): Promise<void> {
  await appStorage.delete(KEY);
  changes.notify();
}
