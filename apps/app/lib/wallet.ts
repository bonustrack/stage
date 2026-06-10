/** Local EOA helpers backing Snapshot's EIP-712 profile signing. The actual key
 *  storage + multi-account registry lives in lib/accounts.ts; this module is a
 *  thin compatibility layer that resolves the *active* account's viem signer
 *  (minting one on first use) so callers don't have to know about the registry. */

/** Side-effect import — installs the crypto.getRandomValues polyfill before any
 *  viem import (see lib/cryptoShim.ts). */
import './cryptoShim';
import { clearAllAccounts } from './accounts';

/** Wipe every account (keys + registry). Caller is responsible for also
 *  resetting downstream identities (XMTP dbs) keyed off these addresses. */
export async function resetAccount(): Promise<void> {
  await clearAllAccounts();
}
