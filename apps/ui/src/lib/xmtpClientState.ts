
import { setCachedRows } from './channelsCache';

export function resetClientScopedState(): void {
  setCachedRows(null);
}
