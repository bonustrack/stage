import type { ConversationView } from './conversation';
import { getCachedRows, setCachedRows, subscribeCachedRows } from '../channelsCache';
import { isRowHidden } from '../sync/hiddenChannels';
import { useStoreValue } from '../storeCore';

export type HomeRow = ConversationView & Record<string, unknown>;

export function homeRows(): HomeRow[] | null {
  return getCachedRows() as HomeRow[] | null;
}

export function useHomeRows(): HomeRow[] | null {
  return useStoreValue(subscribeCachedRows, homeRows);
}

export function homeRowOf(convId: string): HomeRow | undefined {
  return homeRows()?.find((row) => row.convId === convId);
}

export function hasHomeRows(): boolean {
  return (homeRows()?.length ?? 0) > 0;
}

export function updateHomeRows(fn: (prev: HomeRow[] | null) => HomeRow[] | null): void {
  const next = fn(homeRows());
  setCachedRows(next?.filter((row) => !isRowHidden(row)) ?? null);
}
