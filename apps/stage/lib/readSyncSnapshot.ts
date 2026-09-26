import type { SyncMessage } from '@stage-labs/client/xmtp/readState';
import {
  assembleSyncSnapshot, bootChangeCounter, countSyncChange, parseChangeCounter, snapshotDue,
  type ChangeCounter, type CountedScan, type SyncSnapshotContent, type SyncStamps,
} from '@stage-labs/client/xmtp/syncSnapshot';
import { appStorage } from '../platform/storage';
import { loadBoardOrder } from './boardOrder';
import { getCachedRows } from './channelsCache';
import { getClearedChats } from './clearedChats';
import { ignored, recover } from './errorPolicy';
import { loadLabelEntries } from './labelRegistry';
import { loadPinnedOrder } from './pins';
import { readStateEntries } from './xmtp.unread';

const COUNTER_PREFIX = 'readSync.changes.';

interface CounterSlot {
  key: string;
  groupId: string;
  counter: ChangeCounter;
}

let slot: CounterSlot | null = null;

function keep(next: CounterSlot): void {
  slot = next;
  appStorage.set(next.key, JSON.stringify(next.counter)).catch(ignored(undefined, 'cache'));
}

export function clearChangeCounter(): void {
  slot = null;
}

export async function loadChangeCounter(accountId: string, groupId: string, scan: CountedScan): Promise<void> {
  const key = `${COUNTER_PREFIX}${accountId}.${groupId}`;
  const raw = await appStorage.get(key).catch(recover<string | null | undefined>('readSync.counter', undefined));
  if (raw === undefined) return;
  keep({ key, groupId, counter: bootChangeCounter(scan, parseChangeCounter(raw)) });
}

export function countSyncMessage(groupId: string, m: SyncMessage): void {
  if (slot?.groupId !== groupId) return;
  const counter = countSyncChange(slot.counter, m);
  if (counter !== slot.counter) keep({ ...slot, counter });
}

export function syncSnapshotDue(groupId: string): boolean {
  return slot?.groupId === groupId && snapshotDue(slot.counter.count);
}

export function resetChangeCounter(groupId: string): void {
  if (slot?.groupId === groupId) keep({ ...slot, counter: { ...slot.counter, count: 0 } });
}

export async function buildSyncSnapshot(
  accountId: string, seen: ReadonlySet<string>, stamps: SyncStamps, groups: readonly string[],
): Promise<SyncSnapshotContent | null> {
  const rows = getCachedRows();
  if (rows === null) return null;
  const [stored, pinOrder, boardOrder, labels] = await Promise.all([
    readStateEntries(), loadPinnedOrder(), loadBoardOrder(accountId), loadLabelEntries(accountId),
  ]);
  return assembleSyncSnapshot({
    rows,
    stored: new Map(stored),
    seen,
    pinOrder,
    boardOrder,
    labels,
    stamps,
    cleared: getClearedChats(),
    groups,
    at: Date.now(),
  });
}
