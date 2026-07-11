
import '../cryptoShim';
import * as passkey from 'react-native-passkeys';
import { parsePasskeyCred } from '@zerodev/react-native-passkeys-utils';
import {
  findQuoteIndices,
  isRIP7212SupportedNetwork,
  parseAndNormalizeSig,
  uint8ArrayToHexString,
} from '@zerodev/webauthn-key';
import { encodeAbiParameters, type Hex } from 'viem';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decodeClientDataJson,
  effectiveRpId,
  hexToBytes,
  hostSupportsRpId,
  normalizeRegistrationPublicKey,
  signableMessageToHex,
  type RegisterPasskeyOptions,
  type StoredPasskey,
} from './passkeys.model';
import { zerodevRpId } from './env';

type PasskeyGetRequest = Parameters<typeof passkey.get>[0];

export function passkeysAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential === 'function' &&
    hostSupportsRpId(zerodevRpId(), window.location.hostname)
  );
}

async function signMessageWithWebPasskeys(
  message: unknown,
  rpID: string,
  chainId: number,
  allowCredentials?: PasskeyGetRequest['allowCredentials'],
): Promise<Hex> {
  const challenge = bytesToBase64Url(hexToBytes(signableMessageToHex(message)));
  const cred = await passkey.get({
    rpId: rpID,
    challenge,
    allowCredentials,
    userVerification: 'required',
  });
  if (!cred) throw new Error('No passkey credential found');
  const authenticatorDataHex = uint8ArrayToHexString(
    base64UrlToBytes(cred.response.authenticatorData),
  );
  const clientDataJSON = decodeClientDataJson(cred.response.clientDataJSON);
  const { beforeType } = findQuoteIndices(clientDataJSON);
  const { r, s } = parseAndNormalizeSig(
    uint8ArrayToHexString(base64UrlToBytes(cred.response.signature)),
  );
  return encodeAbiParameters(
    [
      { name: 'authenticatorData', type: 'bytes' },
      { name: 'clientDataJSON', type: 'string' },
      { name: 'responseTypeLocation', type: 'uint256' },
      { name: 'r', type: 'uint256' },
      { name: 's', type: 'uint256' },
      { name: 'usePrecompiled', type: 'bool' },
    ],
    [authenticatorDataHex, clientDataJSON, beforeType, r, s, isRIP7212SupportedNetwork(chainId)],
  );
}

export function passkeySignMessageCallback(): unknown {
  return signMessageWithWebPasskeys;
}

function isUserCancelled(e: unknown): boolean {
  return e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError');
}

export async function registerPasskeyCredential(
  hdIndex: number,
  opts: RegisterPasskeyOptions,
): Promise<StoredPasskey | null> {
  if (!passkeysAvailable()) return null;
  try {
    const rpId = effectiveRpId(opts.rpId, window.location.hostname);
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const userTag = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(4)));
    const cred = await passkey.create({
      challenge: bytesToBase64Url(challengeBytes),
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      rp: { id: rpId, name: 'Stage' },
      user: {
        id: bytesToBase64Url(new TextEncoder().encode(`${opts.userName}:${hdIndex}:${userTag}`)),
        name: opts.userName,
        displayName: opts.userDisplayName ?? opts.userName,
      },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    if (!cred) return null;
    const normalized = normalizeRegistrationPublicKey(cred);
    const parsed = parsePasskeyCred(normalized as Parameters<typeof parsePasskeyCred>[0], rpId);
    return {
      pubX: `0x${parsed.pubX.toString(16)}`,
      pubY: `0x${parsed.pubY.toString(16)}`,
      authenticatorId: parsed.authenticatorId,
      authenticatorIdHash: parsed.authenticatorIdHash,
      rpID: rpId,
    };
  } catch (e) {
    if (isUserCancelled(e)) return null;
    throw e instanceof Error ? e : new Error('Passkey registration failed');
  }
}

export async function assertPasskeyPresence(stored: StoredPasskey): Promise<boolean | null> {
  if (!passkeysAvailable()) return null;
  try {
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const assertion = await passkey.get({
      challenge: bytesToBase64Url(challengeBytes),
      rpId: stored.rpID,
      allowCredentials: [{ id: stored.authenticatorId, type: 'public-key' }],
      userVerification: 'required',
    });
    return !!assertion;
  } catch {
    return false;
  }
}
