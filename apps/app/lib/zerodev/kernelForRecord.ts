/** Rebuild the Kernel account + client for an existing smart-account record, for
 *  signing paths (the XMTP SCW signer, lazy-deploy userOps). Re-derives the owner
 *  from the app mnemonic at the record's hdIndex and reconstructs the
 *  counterfactual Kernel at the same deterministic address.
 *
 *  SIGNER SELECTION (Less's hard requirement):
 *    - If the record HAS a passkey (`rec.passkey`), the Kernel is rebuilt with the
 *      PASSKEY validator as the active `sudo` signer, so sendTransaction / userOp /
 *      signMessage / signTypedData ALL go through the on-device WebAuthn prompt and
 *      the mnemonic is NEVER read for signing. The ECDSA owner is only the backup.
 *    - Else (passkey skipped) the Kernel is rebuilt with the ECDSA owner (derived
 *      from the mnemonic) as `sudo`, the always-works fallback.
 *
 *  If a passkey IS recorded but the running binary lacks the native module
 *  (passkeyKernelFromStored returns null), we degrade to the ECDSA owner so an old
 *  binary still loads rather than hard-crashing. */

import '../cryptoShim';
import type { KernelAccountClient } from '@zerodev/sdk';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel, passkeyKernelFromStored } from './account';
import { passkeysAvailable } from './native';

/** Build a Kernel account client for a smart record (re-derives owner at
 *  hdIndex). Throws if the record isn't a smart account or the mnemonic / HD
 *  index is missing. Reading the mnemonic prompts device auth — only call on a
 *  deliberate signing action, never on the boot hot path. */
export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const publicClient = makePublicClient();

  // PASSKEY-ONLY (Less's hard requirement): when the record has a passkey, build
  // the Kernel from the PASSKEY validator alone (sudo=passkey, no regular) and
  // NEVER read the mnemonic. The ECDSA owner is not derived on this path, so the
  // private key is provably not read for signing — every sign is WebAuthn.
  // passkeyKernelFromStored ignores its `owner` arg (it builds from stored pubkey
  // material), so we pass a throwaway placeholder rather than unlock the keyring.
  if (rec.passkey) {
    // ADDRESS OVERRIDE only when the address was NOT derived from the passkey sudo:
    //   - passkeySudo (passkey chosen at CREATE): the natural passkey-sudo address
    //     IS rec.address, so DO NOT pin — let it derive, deploy initCode matches,
    //     first userOp deploys correctly, no enable.
    //   - else (ECDSA-derived address, passkey added via enable): pin to rec.address
    //     so the rebuilt passkey-sudo Kernel keeps the wallet identity.
    const addressOverride = rec.passkeySudo ? undefined : (rec.address as `0x${string}`);
    const passkeyAccount = await passkeyKernelFromStored(
      publicClient,
      undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
      rec.hdIndex,
      rec.passkey,
      addressOverride,
    );
    if (passkeyAccount) return makeKernelClient(passkeyAccount, publicClient);
    // The passkey validator could not be built. The ONLY legitimate reason is an
    // old binary lacking the native module (passkeysAvailable() === false); in
    // that case we degrade to the ECDSA owner so the app still loads. But if the
    // native module IS present and the rebuild still failed, falling back to the
    // ECDSA key would silently sign with the mnemonic for a passkey account — the
    // exact regression we are preventing. Throw in __DEV__ to surface it; in prod
    // fail closed by throwing too (do NOT silently sign with the key).
    if (passkeysAvailable()) {
      throw new Error(
        'Passkey account: passkey validator unavailable; refusing to sign with the ECDSA key.',
      );
    }
    // Old binary without the passkey native module: degrade so the app still loads.
    const ownerForOld = await smartOwnerSigner(rec.hdIndex);
    return makeKernelClient(
      await createEcdsaKernel(publicClient, ownerForOld, rec.hdIndex),
      publicClient,
    );
  }

  // No passkey on the record: the ECDSA owner (derived from the mnemonic) is the
  // sudo validator. This is the only path that reads the key for signing.
  const owner = await smartOwnerSigner(rec.hdIndex);
  return makeKernelClient(await createEcdsaKernel(publicClient, owner, rec.hdIndex), publicClient);
}
