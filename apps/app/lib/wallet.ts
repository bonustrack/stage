/** Local EOA helpers backing Snapshot's EIP-712 profile signing. The actual key
 *  storage + multi-account registry lives in lib/accounts.ts; this module is a
 *  thin compatibility layer that resolves the *active* account's viem signer
 *  (minting one on first use) so callers don't have to know about the registry. */

/** Side-effect import — installs the crypto.getRandomValues polyfill before any
 *  viem import (see lib/cryptoShim.ts). */
import './cryptoShim';
import type { PrivateKeyAccount } from 'viem/accounts';
import {
  getActiveAccount, getViemAccount, addGeneratedAccount, clearAllAccounts,
} from './accounts';

/** The active account as a viem `PrivateKeyAccount` (used for Snapshot EIP-712
 *  signing). Mints + activates a fresh generated account when the registry is
 *  empty. Throws for a WalletConnect-active account — those sign remotely. */
export async function loadOrCreateAccount(): Promise<PrivateKeyAccount> {
  const active = await getActiveAccount();
  if (active) {
    if (active.type === 'walletconnect') {
      throw new Error('Active account is connected via WalletConnect — signing happens in the wallet.');
    }
    const acct = await getViemAccount(active.id);
    if (acct) return acct;
  }
  const rec = await addGeneratedAccount();
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('Failed to create a local account.');
  return acct;
}

/** Wipe every account (keys + registry). Caller is responsible for also
 *  resetting downstream identities (XMTP dbs) keyed off these addresses. */
export async function resetAccount(): Promise<void> {
  await clearAllAccounts();
}
