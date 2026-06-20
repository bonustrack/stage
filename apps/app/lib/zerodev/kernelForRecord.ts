/** @file Rebuilds the Kernel account + client for an existing smart-account record on signing paths, selecting the passkey validator as sudo when present (else the HD-derived ECDSA owner, also a degraded fallback when the native passkey module is absent). */

import '../cryptoShim';
import type { KernelAccountClient } from '@zerodev/sdk';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel, passkeyKernelFromStored } from './account';
import { passkeysAvailable } from './native';

/** Builds a Kernel account client for a smart record (re-deriving owner at hdIndex); throws if it isn't a smart account or the mnemonic/HD index is missing, and since reading the mnemonic prompts device auth, only call on a deliberate signing action. */
export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const publicClient = makePublicClient();

  /** Passkey-only (hard requirement): with a passkey, build the Kernel from the passkey validator alone (sudo=passkey) and never read the mnemonic, so every sign is WebAuthn; passkeyKernelFromStored ignores its `owner` arg, so we pass a throwaway placeholder rather than unlock the keyring. */
  if (rec.passkey) {
    /** Override the address only when it was NOT derived from the passkey sudo: for passkeySudo (passkey chosen at create) the natural passkey-sudo address IS rec.address so let it derive; otherwise (ECDSA-derived address, passkey added via enable) pin to rec.address so the rebuilt Kernel keeps the wallet identity. */
    const addressOverride = rec.passkeySudo ? undefined : (rec.address as `0x${string}`);
    const passkeyAccount = await passkeyKernelFromStored(
      publicClient,
      undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
      rec.hdIndex,
      rec.passkey,
      addressOverride,
    );
    if (passkeyAccount) return makeKernelClient(passkeyAccount, publicClient);
    /** Passkey validator could not be built: the only legitimate cause is an old binary lacking the native module (passkeysAvailable() false), where we degrade to the ECDSA owner; but if the module IS present, falling back would silently sign with the mnemonic for a passkey account, so fail closed by throwing. */
    if (passkeysAvailable()) {
      throw new Error(
        'Passkey account: passkey validator unavailable; refusing to sign with the ECDSA key.',
      );
    }
    /** Old binary without the passkey native module: degrade so the app still loads. */
    const ownerForOld = await smartOwnerSigner(rec.hdIndex);
    return makeKernelClient(
      await createEcdsaKernel(publicClient, ownerForOld, rec.hdIndex),
      publicClient,
    );
  }

  /** No passkey on the record: the ECDSA owner (derived from the mnemonic) is the sudo validator, and this is the only path that reads the key for signing. */
  const owner = await smartOwnerSigner(rec.hdIndex);
  return makeKernelClient(await createEcdsaKernel(publicClient, owner, rec.hdIndex), publicClient);
}
