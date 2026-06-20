/** @file Creates a new ZeroDev Kernel smart account from the single app mnemonic: derive the owner at the next HD index, build the counterfactual ECDSA-sudo Kernel, persist the registry record; passkey-agnostic, so the caller decides what signs the first XMTP inbox. */

/** Passkey is NOT registered here: the account is ALWAYS created ECDSA-sudo (deployable initCode at the ECDSA-derived address); the caller either runs enablePasskeyForRecord first (deploy-and-swap sudo to passkey, then register the inbox via ERC-1271 so the key never signs the identity) or lets the ECDSA owner sign a 6492-wrapped counterfactual inbox; enable-then-register is required because a passkey signature can't validate against the ECDSA 6492 envelope. */

import '../cryptoShim';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { makePublicClient } from './client';
import { createEcdsaKernel } from './account';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  label?: string;
}

/** Create + persist a new active ECDSA-owner smart account (passkey-agnostic; throws if ZeroDev is unconfigured); callers wanting a passkey-gated signer must call enablePasskeyForRecord BEFORE bringing XMTP online so the deployed passkey Kernel signs the first inbox registration. */
export async function createSmartAccount(opts: CreateSmartAccountOpts = {}): Promise<AccountRecord> {
  if (!zerodevConfigured()) {
    throw new Error('Smart wallet is not configured (missing ZeroDev project).');
  }
  /** Minting/reading the mnemonic prompts device auth (acceptable on the new-account path); the owner signer is derived inside the keyring. */
  await ensureMnemonic();
  const hdIndex = await nextSmartHdIndex();
  const owner = await smartOwnerSigner(hdIndex);
  const publicClient = makePublicClient();

  /** ECDSA owner sudo: the address derives from the ECDSA owner (no passkey in the CREATE2 salt) so it is DEPLOYABLE at exactly this address; a passkey is added later via enablePasskeyForRecord, which deploys-and-swaps the sudo at the same address after the XMTP inbox is registered. */
  const account = await createEcdsaKernel(publicClient, owner, hdIndex);
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
    /** Counterfactual until the first sponsored userOp (or the passkey swap) deploys it. */
    deployed: false,
    scwXmtp: true, /** SCW IS the XMTP identity by default (Less): Kernel address registers via ERC-1271 / 6492-while-counterfactual, chainId 8453. */
  };
  return addSmartAccount(rec);
}
