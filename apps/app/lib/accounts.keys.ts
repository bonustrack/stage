/** Private-key STORAGE + signer resolution for the account registry
 *  (see accounts.ts). The pure key RULES (normalizePk, privateKeyFromMnemonic,
 *  canExportPrivateKey) + the storage-key constants moved into the
 *  framework-agnostic Stage SDK (@stage-labs/client); this module keeps only the
 *  expo-secure-store-backed reads, re-exporting the pure pieces so call sites
 *  stay stable.
 *
 *  Keys for the local account types live in expo-secure-store keyed by address
 *  (`wallet.pk.<id>`); a pre-multi-account build kept a single key under
 *  `wallet.privateKey`, which getPrivateKey self-heals into the per-account slot. */

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { type Hex } from 'viem';
import { PK_PREFIX, LEGACY_PK_KEY } from '@stage-labs/client/accounts/keys';

export {
  PK_PREFIX, LEGACY_PK_KEY, LEGACY_DB_DIR,
  normalizePk, privateKeyFromMnemonic, canExportPrivateKey,
} from '@stage-labs/client/accounts/keys';

export async function getPrivateKey(id: string): Promise<Hex | null> {
  const pk = await SecureStore.getItemAsync(PK_PREFIX + id).catch(() => null);
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  /** Self-heal: a key from the pre-multi-account build (or an early multi-account
   *  build that recorded the account but never copied the key) may still live only
   *  under the legacy `wallet.privateKey`. Accept it iff it derives to THIS id, and
   *  re-write it under the per-account key so future reads are direct. WC accounts
   *  have no key anywhere → still null → WC signing path stays intact. */
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await SecureStore.setItemAsync(PK_PREFIX + id, norm).catch(() => undefined);
        return norm;
      }
    } catch { /* malformed legacy key — fall through to null */ }
  }
  return null;
}

export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await getPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}
