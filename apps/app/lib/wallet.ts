/** Local EOA used by both XMTP (as the registration signer) and Snapshot (for
 *  EIP-712 profile updates). The private key lives in expo-secure-store (secure
 *  enclave on iOS, keystore on Android); first-launch mints a fresh one. Same
 *  shape the web app uses in `apps/ui/src/lib/xmtp.ts`. */

import * as SecureStore from 'expo-secure-store';
import {
  generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount,
} from 'viem/accounts';
import { createWalletClient, http, type Hex, type WalletClient } from 'viem';
import { mainnet } from 'viem/chains';

/** SecureStore keys must match `[A-Za-z0-9._-]+`. */
const PRIVATE_KEY_KEY = 'wallet.privateKey';

let cachedAccount: PrivateKeyAccount | null = null;

export async function loadOrCreateAccount(): Promise<PrivateKeyAccount> {
  if (cachedAccount) return cachedAccount;
  const stored = await SecureStore.getItemAsync(PRIVATE_KEY_KEY).catch(() => null);
  if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
    cachedAccount = privateKeyToAccount(stored as Hex);
    return cachedAccount;
  }
  const fresh = generatePrivateKey();
  await SecureStore.setItemAsync(PRIVATE_KEY_KEY, fresh);
  cachedAccount = privateKeyToAccount(fresh);
  return cachedAccount;
}

/** Build a viem WalletClient bound to mainnet — the chain id is informational
 *  here (we don't broadcast L1 txs), but XMTP + EIP-712 both inspect it. */
export async function loadOrCreateWalletClient(): Promise<WalletClient> {
  const account = await loadOrCreateAccount();
  return createWalletClient({ account, chain: mainnet, transport: http() });
}

/** Drop the local EOA. Caller is responsible for also resetting downstream
 *  identities (XMTP db, etc.) since they're keyed off this address. */
export async function resetAccount(): Promise<void> {
  cachedAccount = null;
  await SecureStore.deleteItemAsync(PRIVATE_KEY_KEY).catch(() => undefined);
}
