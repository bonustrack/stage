import '../cryptoShim';
import type { Hex } from 'viem';
import {
  KERNEL_ROOT_VALIDATOR_ABI, WEBAUTHN_STORAGE_ABI, validatorAddressOf, type PasskeyPublicKey,
} from '@stage-labs/client/zerodev/passkeyLink';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { makePublicClient } from './client';
import { zerodevConfigured, zerodevRpId } from './env';
import { linkExistingPasskey, passkeysAvailable } from './passkeys';

export type LinkPasskeyResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'no-passkey' | 'error'; message?: string };

export async function accountPasskey(address: Hex): Promise<PasskeyPublicKey | null> {
  const publicClient = makePublicClient();
  const code = await publicClient.getCode({ address });
  if (!code || code === '0x') return null;
  const rootId = await publicClient.readContract({ address, abi: KERNEL_ROOT_VALIDATOR_ABI, functionName: 'rootValidator' });
  try {
    const [pubX, pubY] = await publicClient.readContract({
      address: validatorAddressOf(rootId), abi: WEBAUTHN_STORAGE_ABI, functionName: 'webAuthnValidatorStorage', args: [address],
    });
    return pubX === 0n && pubY === 0n ? null : { pubX, pubY };
  } catch {
    return null;
  }
}

export function storedPasskeyMatches(rec: AccountRecord, key: PasskeyPublicKey | null): boolean {
  if (!rec.passkey) return false;
  if (!key) return true;
  return BigInt(rec.passkey.pubX) === key.pubX && BigInt(rec.passkey.pubY) === key.pubY;
}

export async function passkeyLinked(rec: AccountRecord): Promise<boolean> {
  if (rec.type !== 'smart' || !rec.passkey) return false;
  try {
    return storedPasskeyMatches(rec, await accountPasskey(rec.address as Hex));
  } catch {
    return true;
  }
}

export async function linkPasskeyForRecord(rec: AccountRecord): Promise<LinkPasskeyResult> {
  if (rec.type !== 'smart') return { ok: false, reason: 'error', message: 'Not a smart account.' };
  if (!passkeysAvailable() || !zerodevConfigured()) return { ok: false, reason: 'unavailable' };
  try {
    const key = await accountPasskey(rec.address as Hex);
    if (!key) return { ok: false, reason: 'no-passkey' };
    const stored = await linkExistingPasskey(zerodevRpId(), key);
    if (!stored) return { ok: false, reason: 'cancelled' };
    await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId, deployed: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Could not link the passkey' };
  }
}

export function describeLinkResult(result: LinkPasskeyResult): string {
  if (result.ok) return 'Passkey linked. This device can now sign transactions for the account.';
  switch (result.reason) {
    case 'unavailable': return 'Passkeys are not available on this device.';
    case 'cancelled': return 'Passkey request cancelled.';
    case 'no-passkey': return 'This account is not secured by a passkey.';
    case 'error': return result.message ?? 'Could not link the passkey.';
  }
}
