import { parseAndNormalizeSig, uint8ArrayToHexString } from '@zerodev/webauthn-key';
import {
  authenticatorIdHashOf, hexOfBigint, passkeyAssertionMatches, type PasskeyPublicKey,
} from '@stage-labs/client/zerodev/passkeyLink';
import { base64UrlToBytes, type StoredPasskey } from './passkeys.model';

export interface PasskeyAssertion {
  rawId: string;
  response: { authenticatorData: string; clientDataJSON: string; signature: string };
}

function isAssertion(value: unknown): value is PasskeyAssertion {
  if (typeof value !== 'object' || value === null) return false;
  const cred = value as { rawId?: unknown; response?: { authenticatorData?: unknown; clientDataJSON?: unknown; signature?: unknown } };
  return typeof cred.rawId === 'string'
    && typeof cred.response?.authenticatorData === 'string'
    && typeof cred.response.clientDataJSON === 'string'
    && typeof cred.response.signature === 'string';
}

export function storedPasskeyFromAssertion(cred: unknown, rpId: string, key: PasskeyPublicKey): StoredPasskey | null {
  if (!isAssertion(cred)) return null;
  const { r, s } = parseAndNormalizeSig(uint8ArrayToHexString(base64UrlToBytes(cred.response.signature)));
  const matches = passkeyAssertionMatches(
    key, base64UrlToBytes(cred.response.authenticatorData), base64UrlToBytes(cred.response.clientDataJSON), r, s,
  );
  if (!matches) throw new Error('That passkey does not belong to this account. Pick the passkey created for this wallet.');
  return {
    pubX: hexOfBigint(key.pubX),
    pubY: hexOfBigint(key.pubY),
    authenticatorId: cred.rawId,
    authenticatorIdHash: authenticatorIdHashOf(base64UrlToBytes(cred.rawId)),
    rpID: rpId,
  };
}
