import { getCachedRows, setCachedRows, subscribeCachedRows } from '../channelsCache';
import type { CachedRow } from '../cachedRows.model';
import { isRowHidden } from '../sync/hiddenChannels';
import { useStoreValue } from '../storeCore';

export function homeRows(): CachedRow[] | null {
  return getCachedRows();
}

export function useHomeRows(): CachedRow[] | null {
  return useStoreValue(subscribeCachedRows, homeRows);
}

export function homeRowOf(convId: string): CachedRow | undefined {
  return homeRows()?.find((row) => row.convId === convId);
}

export function hasHomeRows(): boolean {
  return (homeRows()?.length ?? 0) > 0;
}

export function updateHomeRows(fn: (prev: CachedRow[] | null) => CachedRow[] | null): void {
  const next = fn(homeRows());
  setCachedRows(next?.filter((row) => !isRowHidden(row)) ?? null);
}
