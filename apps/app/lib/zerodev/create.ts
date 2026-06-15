/** Orchestrates creating a new smart (ZeroDev Kernel) account from the single
 *  app mnemonic: ensure the mnemonic, derive the owner at the next HD index,
 *  build the counterfactual Kernel (passkey `sudo` when the native module is
 *  present, ECDSA owner `sudo` otherwise), and persist the registry record.
 *
 *  Thin glue over ./mnemonic + ./account + accounts.ts. No tx is sent — the
 *  Kernel deploys lazily on the first sponsored userOp (phase 2). */

import '../cryptoShim';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { makePublicClient } from './client';
import { createEcdsaKernel, createPasskeyKernel } from './account';
import { passkeysAvailable } from './native';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  /** Passkey relying-party id (the hosted domain, e.g. 'stage.box' / 'metro.box').
   *  Only used when the passkey native module is available. */
  rpId?: string;
  /** Human label for the WebAuthn user (display only). */
  userName?: string;
  label?: string;
}

/** Create + persist a new smart account. Uses the passkey path when available
 *  (user accounts on the new APK), else the ECDSA owner path (always works).
 *  Returns the new record (active). Throws if ZeroDev is not configured. */
export async function createSmartAccount(opts: CreateSmartAccountOpts = {}): Promise<AccountRecord> {
  if (!zerodevConfigured()) {
    throw new Error('Smart wallet is not configured (missing ZeroDev project).');
  }
  // Minting/reading the mnemonic prompts device auth — acceptable here
  // (new-account path). The owner signer is derived inside the keyring.
  await ensureMnemonic();
  const hdIndex = await nextSmartHdIndex();
  const owner = await smartOwnerSigner(hdIndex);
  const publicClient = makePublicClient();

  let account = null as Awaited<ReturnType<typeof createEcdsaKernel>> | null;
  let passkey: AccountRecord['passkey'];
  if (passkeysAvailable() && opts.rpId) {
    // PASSKEY REQUESTED + the native module is present: the account MUST be
    // passkey-sudo or creation MUST fail. createPasskeyKernel returns null ONLY
    // when the binary can't do passkeys (handled above by passkeysAvailable), and
    // otherwise THROWS on any failure/cancel — so we do NOT swallow it into a
    // silent ECDSA account. A passkey-sudo Kernel's address derives from the
    // passkey validator (no override), so rec.address == the deploy address and the
    // first sponsored userOp deploys correctly — NO separate enable step.
    const built = await createPasskeyKernel(publicClient, owner, hdIndex, {
      rpId: opts.rpId,
      userName: opts.userName ?? `stage-${hdIndex}`,
    });
    if (built) {
      account = built.account;
      // Persist the public WebAuthn material so the passkey validator (the ACTIVE
      // signer) can be rebuilt on every later launch without re-registering.
      passkey = built.passkey;
    }
  }
  // ECDSA owner sudo: ONLY when no passkey was requested, or the binary lacks the
  // passkey native module. Never a silent fallback after a requested passkey failed
  // (that throws above).
  if (!account) account = await createEcdsaKernel(publicClient, owner, hdIndex);

  const address = account.address;
  const rec: AccountRecord = {
    id: address.toLowerCase(),
    address,
    type: 'smart',
    label: opts.label,
    dbDir: `xmtp-${address.toLowerCase()}`,
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    ownerAddress: owner.address.toLowerCase(),
    deployed: false,
    // When a passkey was registered it is the sudo signer; persist the material so
    // kernelClientForRecord rebuilds with the passkey validator (not the ECDSA key).
    passkey,
    passkeyCredId: passkey?.authenticatorId,
    // The address was derived from the passkey validator as sudo (no override), so
    // kernelForRecord rebuilds WITHOUT pinning and the first userOp deploys at this
    // exact address. Only set when the passkey path actually produced the account.
    passkeySudo: passkey ? true : undefined,
    scwXmtp: true, // SCW IS the XMTP identity by default (Less): Kernel address
    //              registers via ERC-1271 / 6492-while-counterfactual, chainId 8453.

  };
  return addSmartAccount(rec);
}
