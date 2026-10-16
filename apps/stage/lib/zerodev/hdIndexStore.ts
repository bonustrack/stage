import { secureStorage } from '../../platform/storage';
import { ignored } from '../errorPolicy';
import { makeHdIndexStore, parseHdIndex } from './hdIndexStore.core';

const HD_INDEX_KEY = 'accounts.smart.nextHdIndex';
const keyFor = (phraseId: string): string => `${HD_INDEX_KEY}.${phraseId}`;
const indices = makeHdIndexStore(secureStorage);

export function readSmartHdIndexHighWater(phraseId: string): Promise<number | null> {
  return indices.read(keyFor(phraseId));
}

export function reserveSmartHdIndex(phraseId: string, hdIndex: number): Promise<void> {
  return indices.reserve(keyFor(phraseId), hdIndex);
}

export async function resetSmartHdIndex(phraseId: string): Promise<void> {
  await secureStorage.delete(keyFor(phraseId)).catch(ignored(undefined, 'cleanup'));
}

export async function migrateLegacyHdIndex(phraseId: string): Promise<void> {
  const legacy = await secureStorage.get(HD_INDEX_KEY);
  if (legacy === null) return;
  const highWater = parseHdIndex(legacy);
  if (highWater > 0) await indices.reserve(keyFor(phraseId), highWater - 1);
  await secureStorage.delete(HD_INDEX_KEY).catch(ignored(undefined, 'cleanup'));
}
