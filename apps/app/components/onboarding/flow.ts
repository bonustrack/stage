/**
 * @file Onboarding account logic: create/restore a mnemonic + ZeroDev Kernel wallet, install the passkey, and bring XMTP messaging online.
 */

import {
  restoreMnemonic, createSmartAccount, enablePasskeyForRecord, passkeysAvailable,
} from '../../lib/zerodev';
import { AccountManager } from '../../modules/messaging';

/** Stepwise progress reported to the onboarding UI so the user always sees what stage the (multi-second) setup is at instead of a blind wait. */
export type Stage = 'wallet' | 'messaging' | 'finishing';

/** Thrown when the wallet was created/restored fine but bringing XMTP messaging online failed. The account already exists + is active, so the recovery is a plain Retry of the messaging step — NOT a wipe. */
export class XmtpSetupError extends Error {
  /** The new account id, so a Retry can re-run AccountManager.switch on it. */
  readonly accountId: string;
  constructor(accountId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'XmtpSetupError';
    this.accountId = accountId;
  }
}

/**
 * Bring XMTP online for an already-created account and flip the gate. Shared by
 *  the create/restore paths and by the UI's Retry (which passes the account id
 *  directly so it doesn't re-create a wallet). AWAITS Client.create so we only
 *  enter the app once messaging is registered + usable.
 */
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

/** Build the account, then bring XMTP fully online before signalling the gate. `withPasskey` decides whether we offer the WebAuthn sudo path (skippable). */
async function finishAccount(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('wallet');
  // 1) Create the ECDSA-owner account: its address derives from the ECDSA owner so it
  //    stays gas-sponsor DEPLOYABLE. No passkey on the record yet.
  const rec = await createSmartAccount();
  // 2) When a passkey is requested, install it BEFORE XMTP so the FIRST inbox
  //    registration is signed by the PASSKEY (the key must never sign the identity).
  //    enablePasskeyForRecord runs a WebAuthn CREATE (registration, needs no prior
  //    credential -> no "No available sign-in" modal) then ONE sponsored userOp that
  //    deploys the Kernel (ECDSA initCode -> on-chain address == rec.address) and
  //    swaps the on-chain root sudo to the passkey, persisting rec.passkey. After it
  //    returns, the registry record carries the passkey, so bringMessagingOnline's
  //    Client.create signs the inbox via the deployed passkey Kernel (ERC-1271).
  //    Fail closed: a requested-but-failed passkey must surface, not silently leave
  //    an ECDSA-only account masquerading as passkey-gated.
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!res.ok && res.reason !== 'already') {
      throw new Error(res.message ?? 'Could not set up the passkey for this account.');
    }
  }
  // 3) Bring XMTP online. Signs the inbox registration with the passkey Kernel (when
  //    enabled above) or the silent ECDSA owner (skip path).
  await bringMessagingOnline(rec.id, onStage);
}

/** CREATE path: mint a fresh mnemonic (ensureMnemonic, inside createSmartAccount) and build the smart account. No phrase shown. */
export async function createWallet(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  await finishAccount(withPasskey, onStage);
}

/** RESTORE path: validate + store the pasted phrase, then rebuild the smart account from it. Throws a friendly error on a bad phrase. */
export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<void> {
  /** The keyring validates (BIP-39) + stores hardened; it throws on a bad phrase. */
  onStage?.('wallet');
  await restoreMnemonic(phrase);
  await finishAccount(withPasskey, onStage);
}
