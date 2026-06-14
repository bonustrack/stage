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
  if (passkeysAvailable() && opts.rpId) {
    account = await createPasskeyKernel(publicClient, owner, hdIndex, {
      rpId: opts.rpId,
      userName: opts.userName ?? `stage-${hdIndex}`,
    });
  }
  // Fallback (and the only path until the passkey APK ships): ECDSA owner sudo.
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
    scwXmtp: true, // SCW IS the XMTP identity by default (Less): Kernel address
    //              registers via ERC-1271 / 6492-while-counterfactual, chainId 8453.

  };
  return addSmartAccount(rec);
}
