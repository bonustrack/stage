import { secureStorage } from '../../platform/storage';

const HD_INDEX_KEY = 'accounts.smart.nextHdIndex';

export async function readSmartHdIndexHighWater(): Promise<number | null> {
  const raw = await secureStorage.get(HD_INDEX_KEY).catch(() => null);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function reserveSmartHdIndex(hdIndex: number): Promise<void> {
  await secureStorage.set(HD_INDEX_KEY, String(hdIndex + 1));
}

export async function resetSmartHdIndex(): Promise<void> {
  await secureStorage.delete(HD_INDEX_KEY).catch(() => undefined);
}
