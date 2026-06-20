/** @file Local EOA compatibility layer backing Snapshot's EIP-712 profile signing — resolves the active account's viem signer (minting one on first use) over the lib/accounts registry, plus the dev full-wallet reset. */

/** Side-effect import — installs the crypto.getRandomValues polyfill before any viem import (see lib/cryptoShim.ts). */
import './cryptoShim';
import { clearAllAccounts } from './accounts';
import { resetXmtpClient } from './xmtp.client';
import { clearMnemonic } from './zerodev/keyring';
import { setWalletBackedUp } from './walletBackup';
import { bumpAccountEpoch } from './accountEpoch';

/** Wipe every account (keys + registry). Caller is responsible for also resetting downstream identities (XMTP dbs) keyed off these addresses. */
export async function resetAccount(): Promise<void> {
  await clearAllAccounts();
}

/** Dev full local wipe (registry+keys, XMTP stores/db keys, mnemonic, backup flag) then bumps the account epoch to re-trigger onboarding immediately; remote XMTP identity is untouched beyond dropping local stores. */
export async function resetForOnboarding(): Promise<void> {
  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);
  bumpAccountEpoch();
}
