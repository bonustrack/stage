import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';

const store = new Map<string, AssetRow>();

export function rememberTokenRow(r: AssetRow): string {
  const id = tokenRowId(r);
  store.set(id, r);
  return id;
}

export function getTokenRow(id: string): AssetRow | null {
  return store.get(id) ?? null;
}
