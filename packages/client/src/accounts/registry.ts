import type { AccountRecord } from './types';

export const LEGACY_DB_DIR = 'xmtp';

export function dbDirFor(id: string): string {
  return `xmtp-${id}`;
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type === 'generated' || rec.type === 'privateKey';
}

export function nextHdIndex(usedIndices: readonly number[], highWater: number | null): number {
  const maxUsed = usedIndices.reduce((max, i) => (Number.isInteger(i) && i > max ? i : max), -1);
  return Math.max(maxUsed + 1, highWater ?? 0);
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
  const existing = list.find((a) => a.id === id);
  if (existing) return { list, record: existing };
  const rec: AccountRecord = { id, address, type, dbDir: dbDirFor(id), registered: false, createdAt: now };
  return { list: [...list, rec], record: rec };
}

export function resolveActiveAccount(list: AccountRecord[], activeId: string | null): AccountRecord | null {
  const first = list[0];
  if (first === undefined) return null;
  return list.find((a) => a.id === activeId) ?? first;
}
