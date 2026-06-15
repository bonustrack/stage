/** Local EOA helpers backing Snapshot's EIP-712 profile signing. The actual key
 *  storage + multi-account registry lives in lib/accounts.ts; this module is a
 *  thin compatibility layer that resolves the *active* account's viem signer
 *  (minting one on first use) so callers don't have to know about the registry. */

/** Side-effect import — installs the crypto.getRandomValues polyfill before any
 *  viem import (see lib/cryptoShim.ts). */
import './cryptoShim';
import { clearAllAccounts } from './accounts';
import { resetXmtpClient } from './xmtp.client';
import { clearMnemonic } from './zerodev/keyring';
import { setWalletBackedUp } from './walletBackup';
import { bumpAccountEpoch } from './accountEpoch';

/** Wipe every account (keys + registry). Caller is responsible for also
 *  resetting downstream identities (XMTP dbs) keyed off these addresses. */
export async function resetAccount(): Promise<void> {
  await clearAllAccounts();
}

/** Dev "reset accounts" - full local wallet/account wipe that re-triggers
 *  onboarding (the useAccountGate sees an empty registry after the epoch bump).
 *
 *  Clears, in order:
 *   - the account registry (all records + active pointer + per-account keys +
 *     legacy single key) and every account's on-disk XMTP store + db keys
 *     (via resetXmtpClient, which calls clearAllAccounts internally),
 *   - the single app BIP-39 mnemonic (smart-wallet root),
 *   - the wallet.backupDone flag (so the new wallet sees the backup nudge again),
 *  then bumps the account epoch so the gate re-evaluates IMMEDIATELY (no reload).
 *
 *  WHAT IT WIPES: all local account/wallet state + XMTP sqlite stores for every
 *  account on THIS device. It does not touch remote XMTP network identity beyond
 *  dropping the local stores; a fresh onboarding mints a brand-new wallet, so the
 *  signer selection resets (expected for a fresh-onboarding test). */
export async function resetForOnboarding(): Promise<void> {
  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);
  bumpAccountEpoch();
}
