import { secureStorage } from '../../platform/storage';
import { ignored } from '../errorPolicy';

const HD_INDEX_KEY = 'accounts.smart.nextHdIndex';

const keyFor = (phraseId: string): string => `${HD_INDEX_KEY}.${phraseId}`;

export async function readSmartHdIndexHighWater(phraseId: string): Promise<number | null> {
  const raw = await secureStorage.get(keyFor(phraseId));
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function reserveSmartHdIndex(phraseId: string, hdIndex: number): Promise<void> {
  await secureStorage.set(keyFor(phraseId), String(hdIndex + 1));
}

export async function resetSmartHdIndex(phraseId: string): Promise<void> {
  await secureStorage.delete(keyFor(phraseId)).catch(ignored(undefined, 'cleanup'));
}

export async function migrateLegacyHdIndex(phraseId: string): Promise<void> {
  const legacy = await secureStorage.get(HD_INDEX_KEY);
  if (legacy === null) return;
  await secureStorage.set(keyFor(phraseId), legacy);
  await secureStorage.delete(HD_INDEX_KEY).catch(ignored(undefined, 'cleanup'));
}
