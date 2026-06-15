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
 *  Passkey is SKIPPABLE. When requested, the device passkey is installed BEFORE the
 *  XMTP inbox is registered, so the FIRST inbox registration is signed by the
 *  PASSKEY (Less's hard requirement: the ECDSA key must NEVER sign the XMTP
 *  identity). Ordering inside finishAccount:
 *    1. createSmartAccount        -> ECDSA-derived DEPLOYABLE address (no passkey yet)
 *    2. enablePasskeyForRecord    -> WebAuthn CREATE (registration; needs no prior
 *       passkey, so no "No available sign-in" modal) + ONE sponsored userOp that
 *       DEPLOYS the Kernel (ECDSA initCode, so the on-chain address == rec.address)
 *       AND swaps the on-chain root sudo to the passkey; persists rec.passkey.
 *    3. bringMessagingOnline      -> Client.create signs the inbox registration with
 *       the now-DEPLOYED passkey Kernel via ERC-1271 (the key is never read).
 *  The "skip" path leaves it ECDSA-owner-only: the ECDSA owner signs the inbox
 *  (silent, no WebAuthn), and a passkey can be added later in Settings.
 *
 *  WHY DEPLOY-BEFORE-REGISTER (the verification finding): a passkey-signed inbox
 *  registration CANNOT validate counterfactually at the ECDSA-derived address. The
 *  ERC-6492 envelope on an undeployed Kernel embeds the ECDSA initCode (it must, to
 *  keep the address deployable), so off-chain 6492 validation would deploy an
 *  ECDSA-sudo Kernel and then ask it to validate a PASSKEY signature -> mismatch.
 *  Deploying first (ECDSA initCode -> swap sudo to passkey) makes the on-chain root
 *  validator the passkey, so the registration validates via plain ERC-1271. This is
 *  also why registering the passkey BEFORE the inbox is safe now: WebAuthn CREATE
 *  (not get()) needs no pre-existing credential, so it can't pop the empty picker.
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
 *  scwXmtp:true): Client.create registers the Kernel address inbox via ERC-1271,
 *  chainId 8453, signed by the PASSKEY when one was installed (deployed first, so
 *  the registration validates on-chain) or by the ECDSA owner on the skip path
 *  (6492-wrapped while the Kernel is still counterfactual). The ~20s messaging step
 *  + progress UI below applies unchanged. */

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
