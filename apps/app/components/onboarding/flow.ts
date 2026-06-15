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
 *  Passkey is SKIPPABLE and layered on AFTER messaging: the account is ALWAYS
 *  created ECDSA-owner first (createSmartAccount), its XMTP inbox is registered with
 *  the silent ECDSA owner, and only THEN — when withPasskey + the native module is
 *  present — do we register the device passkey and deploy-and-swap the on-chain sudo
 *  to it (enablePasskeyForRecord, the proven Settings path). The "skip" path leaves
 *  it ECDSA-owner-only (a passkey can be added later in Settings). Registering the
 *  passkey AFTER the inbox exists avoids the first inbox registration popping a
 *  WebAuthn get() that finds no credential ("No available sign-in for Metro").
 *
 *  READINESS GATE (Less): we do NOT flip the account gate / enter the app until
 *  the XMTP client for the new account is actually built + registered + cached.
 *  `AccountManager.switch` runs `Client.create` (the ~20s first-launch MLS +
 *  installation registration) and caches the client on success — so once it
 *  resolves, HomeScreen's getOrCreateXmtpClient returns the warm client instantly
 *  and never trips its 30s init-timeout / Reset error. If XMTP setup genuinely
 *  fails we surface it as an XmtpSetupError so the UI can offer a Retry (NOT the
 *  generic wipe/reset), instead of dropping the user into a broken Home.
 *
 *  The new account's XMTP identity IS the smart account (createSmartAccount sets
 *  scwXmtp:true): Client.create registers the Kernel address inbox via ERC-1271
 *  (6492-wrapped while the Kernel is still counterfactual), chainId 8453. The
 *  ~20s messaging step + progress UI below applies unchanged. */

import {
  restoreMnemonic, createSmartAccount, enablePasskeyForRecord, passkeysAvailable,
} from '../../lib/zerodev';
import { AccountManager } from '../../modules/messaging';

/** Stepwise progress reported to the onboarding UI so the user always sees what
 *  stage the (multi-second) setup is at instead of a blind wait. */
export type Stage = 'wallet' | 'messaging' | 'finishing';

/** Thrown when the wallet was created/restored fine but bringing XMTP messaging
 *  online failed. The account already exists + is active, so the recovery is a
 *  plain Retry of the messaging step — NOT a wipe. */
export class XmtpSetupError extends Error {
  /** The new account id, so a Retry can re-run AccountManager.switch on it. */
  readonly accountId: string;
  constructor(accountId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'XmtpSetupError';
    this.accountId = accountId;
  }
}

/** Bring XMTP online for an already-created account and flip the gate. Shared by
 *  the create/restore paths and by the UI's Retry (which passes the account id
 *  directly so it doesn't re-create a wallet). AWAITS Client.create so we only
 *  enter the app once messaging is registered + usable. */
export async function bringMessagingOnline(
  accountId: string, onStage?: (s: Stage) => void,
): Promise<void> {
  onStage?.('messaging');
  try {
    // Builds + REGISTERS the XMTP client (Client.create on first launch) and
    // caches it. Awaiting this is the readiness gate: when it resolves, Home's
    // getOrCreateXmtpClient returns the warm client and never times out.
    await AccountManager.switch(accountId);
  } catch (e) {
    throw new XmtpSetupError(accountId, e);
  }
  onStage?.('finishing');
  // Repaint the account gate so the app mounts. By now XMTP is warm.
  AccountManager.bumpEpoch();
}

/** Build the account, then bring XMTP fully online before signalling the gate.
 *  `withPasskey` decides whether we offer the WebAuthn sudo path (skippable). */
async function finishAccount(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('wallet');
  // Always create the ECDSA-owner account first. The passkey (when requested) is
  // layered on AFTER XMTP so the first inbox registration signs with the ECDSA
  // owner (silent) rather than an on-device WebAuthn get() that, on a fresh
  // install, finds no credential and pops "No available sign-in for Metro".
  const rec = await createSmartAccount();
  await bringMessagingOnline(rec.id, onStage);
  // Now the inbox exists. Register the device passkey + deploy-and-swap the on-chain
  // sudo to it (the proven Settings enable path) so all later signing is WebAuthn.
  // Fail closed: a requested-but-failed passkey must surface, not silently leave an
  // ECDSA-only account masquerading as passkey-gated.
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!res.ok && res.reason !== 'already') {
      throw new Error(res.message ?? 'Could not set up the passkey for this account.');
    }
  }
}

/** CREATE path: mint a fresh mnemonic (ensureMnemonic, inside createSmartAccount)
 *  and build the smart account. No phrase shown. */
export async function createWallet(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  await finishAccount(withPasskey, onStage);
}

/** RESTORE path: validate + store the pasted phrase, then rebuild the smart
 *  account from it. Throws a friendly error on a bad phrase. */
export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<void> {
  /** The keyring validates (BIP-39) + stores hardened; it throws on a bad phrase. */
  onStage?.('wallet');
  await restoreMnemonic(phrase);
  await finishAccount(withPasskey, onStage);
}
