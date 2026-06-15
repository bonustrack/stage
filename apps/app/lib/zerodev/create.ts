/** Orchestrates creating a new smart (ZeroDev Kernel) account from the single
 *  app mnemonic: ensure the mnemonic, derive the owner at the next HD index,
 *  build the counterfactual ECDSA-owner Kernel, and persist the registry record.
 *
 *  PASSKEY IS NOT REGISTERED HERE. The account is ALWAYS created ECDSA-sudo so its
 *  address derives from the ECDSA owner (deployable initCode) and its FIRST XMTP
 *  inbox registration signs with the mnemonic-derived owner (a silent ECDSA sign,
 *  no WebAuthn prompt). A passkey is layered on AFTERWARDS via
 *  enablePasskeyForRecord — only ONCE the XMTP inbox is already registered — which
 *  deploys-and-swaps the on-chain sudo to the passkey in one sponsored userOp.
 *
 *  WHY THE SPLIT (the regression fix): if rec.passkey were persisted at create
 *  time, the VERY FIRST XMTP inbox registration (kernelClientForRecord keys off
 *  rec.passkey) would sign via an on-device WebAuthn get(). On a fresh
 *  install/recreate that get() pops the OS credential picker and finds nothing
 *  ("No available sign-in for Metro"), wedging onboarding. The proven Settings
 *  enable path never hits this because it registers the passkey AFTER the inbox
 *  already exists. createSmartAccount now mirrors that ordering for onboarding too.
 *
 *  Thin glue over ./mnemonic + ./account + accounts.ts. No tx is sent here — the
 *  Kernel deploys lazily (on the first sponsored userOp, or on the passkey swap). */

import '../cryptoShim';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { makePublicClient } from './client';
import { createEcdsaKernel } from './account';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  label?: string;
}

/** Create + persist a new ECDSA-owner smart account (passkey-agnostic). Returns
 *  the new record (active). Throws if ZeroDev is not configured. Callers that want
 *  a passkey-gated signer must call enablePasskeyForRecord on the returned record
 *  AFTER bringing XMTP online (so the first inbox registration signs with the
 *  ECDSA owner, not a not-yet-discoverable passkey). */
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
