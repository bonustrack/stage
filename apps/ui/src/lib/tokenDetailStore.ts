import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { tokenRowId } from './walletSort';

const store = new Map<string, AssetRow>();

export function rememberTokenRow(r: AssetRow): string {
  const id = tokenRowId(r);
  store.set(id, r);
  return id;
}

export function getTokenRow(id: string): AssetRow | null {
  return store.get(id) ?? null;
}
