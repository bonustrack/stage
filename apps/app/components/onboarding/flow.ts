/** @file Onboarding account logic: create/restore a mnemonic + ZeroDev Kernel wallet, install the passkey, and bring XMTP messaging online. */

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

/** Bring XMTP online for an already-created account and flip the gate; shared by create/restore and the UI Retry, awaiting Client.create so we only enter the app once messaging is registered and usable. */
export async function bringMessagingOnline(
  accountId: string, onStage?: (s: Stage) => void,
): Promise<void> {
  onStage?.('messaging');
  try {
    /** Builds, REGISTERS (Client.create on first launch), and caches the XMTP client; awaiting it is the readiness gate so Home's getOrCreateXmtpClient returns the warm client without timing out. */
    await AccountManager.switch(accountId);
  } catch (e) {
    throw new XmtpSetupError(accountId, e);
  }
  onStage?.('finishing');
  /** Repaint the account gate so the app mounts. By now XMTP is warm. */
  AccountManager.bumpEpoch();
}

/** Build the account, then bring XMTP fully online before signalling the gate. `withPasskey` decides whether we offer the WebAuthn sudo path (skippable). */
async function finishAccount(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('wallet');
  /** 1) Create the ECDSA-owner account, whose address derives from the ECDSA owner so it stays gas-sponsor DEPLOYABLE, with no passkey on the record yet. */
  const rec = await createSmartAccount();
  /** 2) If requested, install the passkey BEFORE XMTP so the first inbox registration is signed by it: WebAuthn CREATE then one sponsored userOp deploys the Kernel and swaps root sudo to the passkey; fail closed so a failed passkey surfaces rather than leaving an ECDSA-only account masquerading as passkey-gated. */
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!res.ok && res.reason !== 'already') {
      throw new Error(res.message ?? 'Could not set up the passkey for this account.');
    }
  }
  /** 3) Bring XMTP online, signing the inbox registration with the passkey Kernel (when enabled above) or the silent ECDSA owner (skip path). */
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
