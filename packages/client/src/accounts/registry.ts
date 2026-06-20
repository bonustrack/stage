
import type { AccountRecord, AccountType } from './types';

export function dbDirFor(id: string): string {
  return `xmtp-${id}`;
}

export function buildLocalAccount(
  id: string,
  address: string,
  type: 'generated' | 'privateKey',
  now: number = Date.now(),
): AccountRecord {
  return { id, address, type, dbDir: dbDirFor(id), registered: false, createdAt: now };
}

export function buildWalletConnectAccount(
  address: string,
  now: number = Date.now(),
): AccountRecord {
  const id = address.toLowerCase();
  return { id, address, type: 'walletconnect', dbDir: dbDirFor(id), registered: false, createdAt: now };
}

export interface AddLocalResult {
  list: AccountRecord[];
  record: AccountRecord;
  upgraded: boolean;
}

export function addLocalAccountToList(
  list: AccountRecord[],
  id: string,
  address: string,
  type: 'generated' | 'privateKey',
  now: number = Date.now(),
): AddLocalResult {
  const existing = list.find(a => a.id === id);
  if (existing) {
    if (existing.type === 'walletconnect') {
      const upgraded: AccountRecord = { ...existing, type };
      return { list: list.map(a => (a.id === id ? upgraded : a)), record: upgraded, upgraded: true };
    }
    return { list, record: existing, upgraded: false };
  }
  const rec = buildLocalAccount(id, address, type, now);
  return { list: [...list, rec], record: rec, upgraded: false };
}

export function resolveActiveAccount(
  list: AccountRecord[],
  activeId: string | null,
): AccountRecord | null {
  const first = list[0];
  if (first === undefined) return null;
  return list.find(a => a.id === activeId) ?? first;
}

export function canSignInApp(type: AccountType): boolean {
  return type !== 'walletconnect';
}
