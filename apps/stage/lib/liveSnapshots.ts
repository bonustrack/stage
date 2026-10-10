import { liveSnapshotJson, liveSnapshotOf, type LiveState } from '../components/dashboard/liveWidget.model';
import { appStorage } from '../platform/storage';
import { attempt } from './errorPolicy';

const SNAPSHOT_PREFIX = 'liveFrame.v1.';

function snapshotKey(accountId: string, widgetId: string): string {
  return `${SNAPSHOT_PREFIX}${accountId}.${widgetId}`;
}

export async function readLiveSnapshot(accountId: string, widgetId: string): Promise<LiveState> {
  return liveSnapshotOf(await appStorage.get(snapshotKey(accountId, widgetId)));
}

export function saveLiveSnapshot(accountId: string, widgetId: string, state: LiveState): void {
  const json = liveSnapshotJson(state);
  if (json !== null) attempt(() => appStorage.set(snapshotKey(accountId, widgetId), json), 'cache');
}

export function forgetLiveSnapshots(accountId: string, widgetIds: readonly string[]): void {
  for (const id of widgetIds) attempt(() => appStorage.delete(snapshotKey(accountId, id)), 'cleanup');
}
