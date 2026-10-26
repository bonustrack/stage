
import type { AccountRecord } from './types';

export function dbDirFor(id: string): string {
  return `xmtp-${id}`;
}

export interface AddLocalResult {
  list: AccountRecord[];
  record: AccountRecord;
}

export function addLocalAccountToList(
  list: AccountRecord[],
  id: string,
  address: string,
  type: 'generated' | 'privateKey',
  now: number = Date.now(),
): AddLocalResult {
  const existing = list.find(a => a.id === id);
  if (existing) return { list, record: existing };
  const rec: AccountRecord = { id, address, type, dbDir: dbDirFor(id), registered: false, createdAt: now };
  return { list: [...list, rec], record: rec };
}

export function resolveActiveAccount(
  list: AccountRecord[],
  activeId: string | null,
): AccountRecord | null {
  const first = list[0];
  if (first === undefined) return null;
  return list.find(a => a.id === activeId) ?? first;
}
