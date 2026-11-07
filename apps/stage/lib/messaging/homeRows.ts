import { getCachedRows, setCachedRows, subscribeCachedRows } from '../channelsCache';
import type { CachedRow } from '../cachedRows.model';
import { isRowHidden } from '../sync/hiddenChannels';
import { useStoreValue } from '../storeCore';

export function useHomeRows(): CachedRow[] | null {
  return useStoreValue(subscribeCachedRows, getCachedRows);
}

export function homeRowOf(convId: string): CachedRow | undefined {
  return getCachedRows()?.find((row) => row.convId === convId);
}

export function hasHomeRows(): boolean {
  return (getCachedRows()?.length ?? 0) > 0;
}

export function updateHomeRows(fn: (prev: CachedRow[] | null) => CachedRow[] | null): void {
  const next = fn(getCachedRows());
  setCachedRows(next?.filter((row) => !isRowHidden(row)) ?? null);
}
