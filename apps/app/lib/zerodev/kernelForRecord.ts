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

/** Build a Kernel account client for a smart record (re-derives owner at
 *  hdIndex). Throws if the record isn't a smart account or the mnemonic / HD
 *  index is missing. Reading the mnemonic prompts device auth — only call on a
 *  deliberate signing action, never on the boot hot path. */
export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const owner = await smartOwnerSigner(rec.hdIndex);
  const publicClient = makePublicClient();
  // Passkey-when-set: rebuild with the passkey validator as the active signer so
  // every sign triggers a WebAuthn prompt and the private key is unused. Null
  // (no passkey, or native module absent) -> ECDSA owner sudo (current behavior).
  const account =
    (rec.passkey && (await passkeyKernelFromStored(publicClient, owner, rec.hdIndex, rec.passkey))) ||
    (await createEcdsaKernel(publicClient, owner, rec.hdIndex));
  return makeKernelClient(account, publicClient);
}
