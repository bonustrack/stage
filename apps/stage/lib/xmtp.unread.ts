import { secureStorage } from '../platform/storage';
import { getSecure, setSecure } from './cache.shared';
import { ignored } from './errorPolicy';

const LAST_READ_PREFIX = 'unread.lastRead.';
export async function getLastReadNs(convId: string): Promise<number> {
  const raw = await getSecure(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export async function setLastReadNs(convId: string, ns: number): Promise<void> {
  await setSecure(LAST_READ_PREFIX + convId, String(ns));
}

const MARKED_UNREAD_PREFIX = 'unread.marked.';
export async function getMarkedUnread(convId: string): Promise<boolean> {
  return (await getSecure(MARKED_UNREAD_PREFIX + convId)) === '1';
}
export async function setMarkedUnreadFlag(convId: string, value: boolean): Promise<void> {
  if (value) await setSecure(MARKED_UNREAD_PREFIX + convId, '1');
  else await clearMarkedUnread(convId);
}

async function clearMarkedUnread(convId: string): Promise<void> {
  await secureStorage.delete(MARKED_UNREAD_PREFIX + convId).catch(ignored(undefined, 'cleanup'));
}

export async function markConvReadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, Date.now() * 1_000_000);
  await clearMarkedUnread(convId);
}

export async function markConvUnreadSynced(convId: string): Promise<void> {
  await setSecure(MARKED_UNREAD_PREFIX + convId, '1');
}
