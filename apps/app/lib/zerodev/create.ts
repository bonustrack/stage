/**
 * @file Orchestrates creating a new ZeroDev Kernel smart account from the single app mnemonic:
 *  derive the owner at the next HD index, build the counterfactual ECDSA-sudo Kernel, and persist
 *  the registry record (passkey-agnostic; the caller decides what signs the first XMTP inbox).
 */

/*
 *  PASSKEY IS NOT REGISTERED HERE. createSmartAccount is passkey-AGNOSTIC: the
 *  account is ALWAYS created ECDSA-sudo so its address derives from the ECDSA owner
 *  (deployable initCode). The CALLER decides what signs the first XMTP inbox:
 *    - passkey requested -> the caller (onboarding flow / add-account) runs
 *      enablePasskeyForRecord FIRST (WebAuthn CREATE + deploy-and-swap the on-chain
 *      sudo to the passkey), THEN brings XMTP online, so the inbox registration is
 *      signed by the deployed passkey Kernel (ERC-1271). The key never signs it.
 *    - skip -> the ECDSA owner signs the inbox (silent, 6492-wrapped counterfactual).
 *
 *  WHY ENABLE-THEN-REGISTER (not the reverse): a passkey-signed registration cannot
 *  validate counterfactually at the ECDSA-derived address (the 6492 envelope embeds
 *  the ECDSA initCode, so off-chain validation deploys an ECDSA Kernel and rejects a
 *  passkey signature). Deploying first (ECDSA initCode -> swap sudo to passkey) makes
 *  the on-chain root validator the passkey, so the registration validates via plain
 *  ERC-1271. WebAuthn CREATE (registration) needs no pre-existing credential, so doing
 *  it before the inbox can't pop the empty OS picker ("No available sign-in").
 *
 *  Thin glue over ./mnemonic + ./account + accounts.ts. No tx is sent here — the
 *  Kernel deploys lazily (on the first sponsored userOp, or on the passkey swap).
 */

import '../cryptoShim';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { makePublicClient } from './client';
import { createEcdsaKernel } from './account';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  label?: string;
}

/**
 * Create + persist a new ECDSA-owner smart account (passkey-agnostic). Returns
 *  the new record (active). Throws if ZeroDev is not configured. Callers that want
 *  a passkey-gated signer must call enablePasskeyForRecord on the returned record
 *  BEFORE bringing XMTP online (so the deployed passkey Kernel signs the first inbox
 *  registration via ERC-1271 and the ECDSA key never signs the XMTP identity).
 */
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

  // ECDSA owner sudo: the address derives from the ECDSA owner (no passkey in the
  // CREATE2 salt) so it is DEPLOYABLE at exactly this address. A passkey is added
  // later via enablePasskeyForRecord, which deploys-and-swaps the sudo at this same
  // address in one sponsored userOp (after the XMTP inbox is already registered).
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
    // Counterfactual until the first sponsored userOp (or the passkey swap) deploys it.
    deployed: false,
    scwXmtp: true, // SCW IS the XMTP identity by default (Less): Kernel address
    //              registers via ERC-1271 / 6492-while-counterfactual, chainId 8453.
  };
  return addSmartAccount(rec);
}
