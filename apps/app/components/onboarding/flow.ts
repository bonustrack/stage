/** Onboarding flow logic — create / restore a wallet, mnemonic + ZeroDev only.
 *
 *  The screens (Welcome/Restore/Passkey) are dumb; the account work lives here so
 *  it stays testable and low-LOC. Locked account model (see docs/zerodev spec):
 *    - CREATE:  generate a mnemonic -> store it hardened (enclave) -> build a
 *      gasless counterfactual ZeroDev Kernel on Base. No phrase is shown during
 *      onboarding (backup is deferred to a skippable nudge later).
 *    - RESTORE: validate the pasted BIP-39 phrase -> store it hardened -> rebuild
 *      the same deterministic Kernel from the re-derived owner.
 *
 *  Passkey is SKIPPABLE: createSmartAccount uses the passkey path only when the
 *  native module is present AND an rpId is passed. The "skip" path simply omits
 *  rpId so the account is ECDSA-owner-only (a passkey can be added later).
 *
 *  XMTP cutover stays OFF (createSmartAccount sets scwXmtp:false). */

import { restoreMnemonic, createSmartAccount, zerodevRpId } from '../../lib/zerodev';
import { AccountManager } from '../../modules/messaging';

/** Build the account, switch the live XMTP client onto it, and signal the gate.
 *  `withPasskey` decides whether we offer the WebAuthn sudo path (skippable). */
async function finishAccount(withPasskey: boolean): Promise<void> {
  const rec = await createSmartAccount(
    withPasskey ? { rpId: zerodevRpId(), userName: 'metro' } : {},
  );
  // Switch the XMTP client in place. Never block the wallet on an XMTP hiccup —
  // the account exists either way; messaging revalidates from Home.
  try { await AccountManager.switch(rec.id); } catch { /* messaging resets at Home */ }
  // Repaint the account gate so the app mounts (createSmartAccount already set
  // active; this guarantees the no-account gate flips even if switch threw early).
  AccountManager.bumpEpoch();
}

/** CREATE path: mint a fresh mnemonic (ensureMnemonic, inside createSmartAccount)
 *  and build the smart account. No phrase shown. */
export async function createWallet(withPasskey: boolean): Promise<void> {
  await finishAccount(withPasskey);
}

/** RESTORE path: validate + store the pasted phrase, then rebuild the smart
 *  account from it. Throws a friendly error on a bad phrase. */
export async function restoreWallet(phrase: string, withPasskey: boolean): Promise<void> {
  /** The keyring validates (BIP-39) + stores hardened; it throws on a bad phrase. */
  await restoreMnemonic(phrase);
  await finishAccount(withPasskey);
}
