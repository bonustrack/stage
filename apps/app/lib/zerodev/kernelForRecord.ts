/** Rebuild the Kernel account + client for an existing smart-account record, for
 *  signing paths (the XMTP SCW signer, lazy-deploy userOps). Re-derives the owner
 *  from the app mnemonic at the record's hdIndex and reconstructs the
 *  counterfactual Kernel at the same deterministic address.
 *
 *  PHASE 1: ECDSA-owner reconstruction (always works, no native dep). The passkey
 *  `sudo` reconstruction (Path B) is phase 2/3 — for now the SCW signer signs via
 *  the ECDSA owner, which is sufficient for XMTP ERC-1271/6492 registration. */

import '../cryptoShim';
import type { KernelAccountClient } from '@zerodev/sdk';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel } from './account';

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
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  return makeKernelClient(account, publicClient);
}
